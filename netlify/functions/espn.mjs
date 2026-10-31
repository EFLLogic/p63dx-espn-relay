// P63DX ESPN relay as a Netlify Function (runs on AWS, not Cloudflare, so
// ESPN answers it). Serves /espn and /health on the Netlify site's address.

import { handleRelay } from "../../relay-core.mjs";

export default async (request) => {
  const url = new URL(request.url);
  const result = await handleRelay({
    pathname: url.pathname,
    method: request.method,
    target: url.searchParams.get("url"),
    givenToken: request.headers.get("x-relay-token") ?? undefined,
    expectedToken: (process.env.RELAY_TOKEN || "").trim(),
  });
  return new Response(result.body, {
    status: result.status,
    headers: { "content-type": result.contentType, "cache-control": "no-store" },
  });
};

export const config = { path: ["/espn", "/health"] };
