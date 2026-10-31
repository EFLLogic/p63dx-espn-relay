// Shared relay logic for the Node server (server.mjs) and the Netlify
// function (netlify/functions/espn.mjs). Only https://*.espn.com addresses
// are fetched, and responses are cached briefly so many TVs cost ESPN one
// request.

import { timingSafeEqual } from "node:crypto";

const CACHE_MS = 60_000;
const FAILURE_CACHE_MS = 5_000;
const TIMEOUT_MS = 10_000;
const MAX_CACHE_ENTRIES = 500;
const ALLOWED_HOST = /(^|\.)espn\.com$/i;

const cache = new Map(); // url -> { expires, status, body, contentType }
const pending = new Map(); // url -> Promise<entry>

const json = (status, value) => ({
  status,
  body: Buffer.from(JSON.stringify(value)),
  contentType: "application/json",
});

export function tokenOk(expected, given) {
  if (!expected) return true;
  const a = Buffer.from(String(given || ""));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseTarget(raw) {
  try {
    const target = new URL(raw);
    if (target.protocol !== "https:") return null;
    if (!ALLOWED_HOST.test(target.hostname)) return null;
    return target.toString();
  } catch {
    return null;
  }
}

async function load(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 (compatible; P63DX-relay/1.0)",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const entry = {
    status: response.status,
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/json",
    expires: Date.now() + (response.ok ? CACHE_MS : FAILURE_CACHE_MS),
  };
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(url, entry);
  return entry;
}

function getEntry(url) {
  const saved = cache.get(url);
  if (saved && saved.expires > Date.now()) return Promise.resolve(saved);
  const existing = pending.get(url);
  if (existing) return existing;
  const request = load(url).finally(() => pending.delete(url));
  pending.set(url, request);
  return request;
}

/**
 * Handle one relay request.
 * @param {{ pathname: string, method: string, target: string | null,
 *           givenToken: string | undefined, expectedToken: string }} req
 * @returns {Promise<{ status: number, body: Buffer, contentType: string }>}
 */
export async function handleRelay({ pathname, method, target, givenToken, expectedToken }) {
  if (pathname === "/health") return json(200, { ok: true });
  if (pathname !== "/espn" || method !== "GET") return json(404, { error: "Not found" });
  if (!tokenOk(expectedToken, givenToken)) return json(401, { error: "Not authorized" });
  const url = parseTarget(target);
  if (!url) return json(400, { error: "Only https://*.espn.com addresses are relayed" });
  try {
    const entry = await getEntry(url);
    return { status: entry.status, body: entry.body, contentType: entry.contentType };
  } catch (error) {
    return json(502, { error: "ESPN unavailable", reason: error instanceof Error ? error.name : "unavailable" });
  }
}
