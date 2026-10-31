// P63DX ESPN relay — standalone Node server (Railway, Render, a spare PC).
// For Netlify, see netlify/functions/espn.mjs; both share relay-core.mjs.
//
//   GET /espn?url=<full https://...espn.com/... address>
//   Header x-relay-token: <RELAY_TOKEN>   (required when RELAY_TOKEN is set)
//   GET /health  -> {"ok":true}

import http from "node:http";
import { handleRelay } from "./relay-core.mjs";

const PORT = Number(process.env.PORT) || 8080;
const TOKEN = (process.env.RELAY_TOKEN || "").trim();

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", "http://relay.local");
  const result = await handleRelay({
    pathname: requestUrl.pathname,
    method: req.method || "GET",
    target: requestUrl.searchParams.get("url"),
    givenToken: req.headers["x-relay-token"],
    expectedToken: TOKEN,
  });
  res.writeHead(result.status, { "content-type": result.contentType, "cache-control": "no-store" });
  res.end(result.body);
});

server.listen(PORT, () => {
  console.log(`P63DX ESPN relay listening on ${PORT}${TOKEN ? " (token required)" : ""}`);
});
