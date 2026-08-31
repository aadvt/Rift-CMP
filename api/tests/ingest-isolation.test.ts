import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import { POST } from "@/app/api/v1/events/route";
import { buildEvent, createOwnershipTree, ingestRequest, resetDatabase } from "./helpers/fixtures";

beforeEach(resetDatabase);

describe("cross-tenant event creation", () => {
  it("refuses an event that claims another organisation's site_id", async () => {
    const { siteA1, siteB1 } = await createOwnershipTree();

    // Site A1's key, but the body claims the event belongs to Site B1.
    const response = await POST(
      ingestRequest({ events: [buildEvent({ site_id: siteB1.siteId })] }, { key: siteA1.publicKey }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { details: [{ code: "site_mismatch" }] },
    });
    expect(await prisma.event.count()).toBe(0);
  });

  it("refuses an event that claims a sibling site in the same organisation", async () => {
    const { siteA1, siteA2 } = await createOwnershipTree();

    // A public key authorises exactly one site, not the whole organisation.
    const response = await POST(
      ingestRequest({ events: [buildEvent({ site_id: siteA2.siteId })] }, { key: siteA1.publicKey }),
    );

    expect(response.status).toBe(400);
    expect(await prisma.event.count({ where: { siteId: siteA2.siteId } })).toBe(0);
  });

  it("accepts only the authorised events from a mixed batch", async () => {
    const { siteA1, siteB1 } = await createOwnershipTree();

    const mine = buildEvent({ site_id: siteA1.siteId });
    const theirs = buildEvent({ site_id: siteB1.siteId });

    const response = await POST(
      ingestRequest({ events: [mine, theirs] }, { key: siteA1.publicKey }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ accepted: 1, rejected: 1 });

    expect(await prisma.event.count({ where: { siteId: siteA1.siteId } })).toBe(1);
    expect(await prisma.event.count({ where: { siteId: siteB1.siteId } })).toBe(0);
  });

  it("never lets a rejected event reach the database under the authenticated site", async () => {
    const { siteA1, siteB1 } = await createOwnershipTree();
    const smuggled = buildEvent({ site_id: siteB1.siteId });

    await POST(ingestRequest({ events: [smuggled] }, { key: siteA1.publicKey }));

    expect(await prisma.event.findUnique({ where: { eventId: smuggled.event_id } })).toBeNull();
  });
});

describe("session isolation", () => {
  it("refuses to attach an event to a session owned by another site", async () => {
    const { siteA1, siteB1 } = await createOwnershipTree();

    const hijackTarget = randomUUID();
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    await prisma.session.create({
      data: { id: hijackTarget, siteId: siteB1.siteId, startedAt, lastActivity: startedAt },
    });

    const response = await POST(
      ingestRequest(
        { events: [buildEvent({ site_id: siteA1.siteId, session_id: hijackTarget })] },
        { key: siteA1.publicKey },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { details: [{ code: "session_conflict" }] },
    });

    // Site B's session is untouched: still owned by B, activity not advanced.
    const session = await prisma.session.findUniqueOrThrow({ where: { id: hijackTarget } });
    expect(session.siteId).toBe(siteB1.siteId);
    expect(session.lastActivity.toISOString()).toBe(startedAt.toISOString());
    expect(await prisma.event.count()).toBe(0);
  });

  it("keeps each site's sessions separate", async () => {
    const { siteA1, siteB1 } = await createOwnershipTree();

    await POST(
      ingestRequest({ events: [buildEvent({ site_id: siteA1.siteId })] }, { key: siteA1.publicKey }),
    );
    await POST(
      ingestRequest({ events: [buildEvent({ site_id: siteB1.siteId })] }, { key: siteB1.publicKey }),
    );

    const sessionsOfA = await prisma.session.findMany({ where: { siteId: siteA1.siteId } });
    const sessionsOfB = await prisma.session.findMany({ where: { siteId: siteB1.siteId } });

    expect(sessionsOfA).toHaveLength(1);
    expect(sessionsOfB).toHaveLength(1);
    expect(sessionsOfA[0].id).not.toBe(sessionsOfB[0].id);
  });

  it("advances session activity only for the owning site", async () => {
    const { siteA1 } = await createOwnershipTree();
    const sessionId = randomUUID();

    await POST(
      ingestRequest(
        {
          events: [
            buildEvent({
              site_id: siteA1.siteId,
              session_id: sessionId,
              event_time: "2026-01-01T00:00:00.000Z",
            }),
            buildEvent({
              site_id: siteA1.siteId,
              session_id: sessionId,
              event_time: "2026-01-01T00:05:00.000Z",
            }),
          ],
        },
        { key: siteA1.publicKey },
      ),
    );

    const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.siteId).toBe(siteA1.siteId);
    expect(session.startedAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(session.lastActivity.toISOString()).toBe("2026-01-01T00:05:00.000Z");
  });
});

describe("event isolation and idempotency", () => {
  it("scopes stored events to the authenticated site only", async () => {
    const { siteA1, siteA2, siteB1 } = await createOwnershipTree();

    await POST(
      ingestRequest({ events: [buildEvent({ site_id: siteA1.siteId })] }, { key: siteA1.publicKey }),
    );
    await POST(
      ingestRequest({ events: [buildEvent({ site_id: siteB1.siteId })] }, { key: siteB1.publicKey }),
    );

    expect(await prisma.event.count({ where: { siteId: siteA1.siteId } })).toBe(1);
    expect(await prisma.event.count({ where: { siteId: siteA2.siteId } })).toBe(0);
    expect(await prisma.event.count({ where: { siteId: siteB1.siteId } })).toBe(1);
  });

  it("deduplicates repeated event ids inside one batch", async () => {
    const { siteA1 } = await createOwnershipTree();
    const event = buildEvent({ site_id: siteA1.siteId });

    const response = await POST(
      ingestRequest({ events: [event, event] }, { key: siteA1.publicKey }),
    );

    await expect(response.json()).resolves.toMatchObject({ accepted: 1, rejected: 1 });
    expect(await prisma.event.count()).toBe(1);
  });

  it("is idempotent when the SDK replays a batch", async () => {
    const { siteA1 } = await createOwnershipTree();
    const event = buildEvent({ site_id: siteA1.siteId });

    await POST(ingestRequest({ events: [event] }, { key: siteA1.publicKey }));
    const replay = await POST(ingestRequest({ events: [event] }, { key: siteA1.publicKey }));

    expect(replay.status).toBe(202);
    expect(await prisma.event.count()).toBe(1);
  });

  it("accepts a bare single event, not just a batch", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await POST(
      ingestRequest(buildEvent({ site_id: siteA1.siteId }), { key: siteA1.publicKey }),
    );

    expect(response.status).toBe(202);
    expect(await prisma.event.count()).toBe(1);
  });
});
