export function setCorsHeaders(response: Response): Response {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

export function jsonError(
  code: string,
  message: string,
  details: unknown[] = [],
  status = code === "not_found" ? 404 : 400,
) {
  return setCorsHeaders(
    Response.json(
      {
        error: {
          code,
          message,
          details,
        },
      },
      { status },
    ),
  );
}
