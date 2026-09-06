export * from "./event";
export * from "./tenancy";
export * from "./api";
export * from "./consent";
export * from "./transfer";
export * from "./authorisation";
export * from "./audit";
export * from "./analytics";
export * from "./consent-analytics";
export * from "./consent-quality";
export * from "./consent-intelligence";
export * from "./discovery";
export * from "./scan";
export * from "./consent-config";
// Both are pure - no `node:crypto`, no Node built-ins - so they are safe in the
// barrel the browser SDK bundles. `consent-signature` is not, and stays a
// subpath import for the reason spelled out below.
export * from "./consent-firewall";
export * from "./redaction";
export * from "./enforcement";
// Pure: the assignment hash is FNV-1a rather than node:crypto precisely so the
// browser SDK can compute an arm without pulling a Node built-in into the bundle.
export * from "./experiment";
export * from "./experiment-analytics";
// `graph` is deliberately not re-exported: it names MAX_NODES and MAX_DEPTH,
// and so does `redaction`. Two modules owning one name in the barrel is a real
// ambiguity, and renaming either would make that one read worse for the sake of
// a convenience import. Use `@rift-cmp/shared/graph`.

// `consent-proof` is deliberately NOT re-exported here.
//
// It imports `node:crypto`, and this barrel is what the browser SDK pulls in.
// Re-exporting it put a dynamic `require("crypto")` into the production bundle
// and broke it at load - caught by `sdk/scripts/verify-global.mjs`, which is
// exactly the failure that gate exists for. Import it by subpath instead:
//
//   import { proofHash } from "@rift-cmp/shared/consent-proof";
//
// `consent-signature` is excluded for the same reason: it signs with
// `node:crypto`, and a signing key has no business near a browser bundle.
