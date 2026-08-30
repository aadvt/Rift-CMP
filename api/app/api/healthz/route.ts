import { setCorsHeaders } from "@/lib/cors";

export async function GET() {
  return setCorsHeaders(Response.json({ status: "ok" }, { status: 200 }));
}

export async function OPTIONS() {
  return setCorsHeaders(new Response(null, { status: 204 }));
}
