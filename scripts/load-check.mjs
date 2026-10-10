// Load check (phase 5.8): N headless editors type into one note for a while.
//
//   node scripts/load-check.mjs                 10 clients, 120 seconds
//   CLIENTS=20 SECONDS=30 node scripts/load-check.mjs
//
// Needs the local stack and the collab server running. It creates throwaway users, one space and
// one note, reports propagation latency (p50, p95, max), whether every client converged to the
// same document, and the server's memory from /health, then removes what it created.

import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import * as Y from "yjs";

const CLIENTS = Number(process.env.CLIENTS ?? 10);
const SECONDS = Number(process.env.SECONDS ?? 120);
const KEYS_PER_SECOND = Number(process.env.KEYS_PER_SECOND ?? 2);

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}
const collabEnv = loadEnv(new URL("../apps/collab/.env.local", import.meta.url));
const webEnv = loadEnv(new URL("../apps/web/.env.local", import.meta.url));
const SUPABASE_URL = collabEnv.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = collabEnv.SUPABASE_SERVICE_ROLE_KEY ?? collabEnv.SUPABASE_SECRET_KEY;
const ANON_KEY = webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const COLLAB_HTTP = process.env.COLLAB_URL ?? "http://localhost:1234";
const COLLAB_WS = COLLAB_HTTP.replace(/^http/, "ws");
const SECRET = collabEnv.INTERNAL_SECRET;
if (!SERVICE_KEY || !ANON_KEY || !SECRET) throw new Error("missing keys in the .env.local files");

async function api(path, init = {}, key = SERVICE_KEY) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const run = randomUUID().slice(0, 8);
const users = [];
let spaceId = null;

async function cleanup() {
  try {
    if (spaceId) await api(`/rest/v1/spaces?id=eq.${spaceId}`, { method: "DELETE" });
    for (const u of users) await api(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" });
  } catch (error) {
    console.error("cleanup problem:", error.message);
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main() {
  console.log(`creating ${CLIENTS} users...`);
  for (let i = 0; i < CLIENTS; i++) {
    const email = `load-${run}-${i}@scraps.test`;
    const password = randomUUID();
    const created = await api("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const session = await api(
      "/auth/v1/token?grant_type=password",
      { method: "POST", body: JSON.stringify({ email, password }) },
      ANON_KEY,
    );
    users.push({ id: created.id, token: session.access_token });
  }

  const owner = users[0];
  spaceId = randomUUID();
  await api("/rest/v1/spaces", {
    method: "POST",
    body: JSON.stringify({ id: spaceId, owner_id: owner.id, name: `load ${run}`, color: "yellow" }),
  });
  // the trigger makes the owner a member; everyone else joins as an editor
  await api("/rest/v1/space_members", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify(
      users.slice(1).map((u) => ({ space_id: spaceId, user_id: u.id, role: "editor" })),
    ),
  });

  const noteId = randomUUID();
  const created = await fetch(`${COLLAB_HTTP}/notes`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-secret": SECRET },
    body: JSON.stringify({
      id: noteId,
      spaceId,
      userId: owner.id,
      start: "text",
      title: "load check",
    }),
  });
  if (!created.ok) throw new Error(`create note: ${created.status}`);

  console.log(`connecting ${CLIENTS} editors to ${noteId}...`);
  const clients = [];
  for (let i = 0; i < CLIENTS; i++) {
    const doc = new Y.Doc();
    const socket = new HocuspocusProviderWebsocket({
      url: COLLAB_WS,
      WebSocketPolyfill: WebSocket,
    });
    const provider = new HocuspocusProvider({
      name: noteId,
      document: doc,
      websocketProvider: socket,
      token: users[i].token,
    });
    provider.attach();
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`client ${i} did not sync`)), 15000);
      provider.on("synced", () => {
        clearTimeout(t);
        resolve();
      });
    });
    clients.push({ doc, provider, socket, index: i, log: doc.getArray("loadlog") });
  }

  // each keystroke appends {from, sentAt, seq} to a shared array; every other client records the
  // delay between sentAt and the moment the item reached it
  const latencies = [];
  let sent = 0;
  for (const c of clients) {
    c.log.observe((event) => {
      const now = Date.now();
      for (const item of event.changes.delta.flatMap((d) => d.insert ?? [])) {
        if (item.from !== c.index) latencies.push(now - item.sentAt);
      }
    });
  }

  const memory = [];
  const memTimer = setInterval(async () => {
    try {
      const health = await (await fetch(`${COLLAB_HTTP}/health`)).json();
      memory.push(health.rssMb);
    } catch {
      // keep going
    }
  }, 5000);

  console.log(`typing for ${SECONDS}s at ~${KEYS_PER_SECOND} keys/s per client...`);
  const interval = 1000 / KEYS_PER_SECOND;
  const timers = clients.map((c) =>
    setInterval(
      () => {
        c.log.push([{ from: c.index, sentAt: Date.now(), seq: sent++ }]);
      },
      interval + Math.random() * 40,
    ),
  );
  await new Promise((r) => setTimeout(r, SECONDS * 1000));
  timers.forEach(clearInterval);
  clearInterval(memTimer);

  // let the last updates land, then compare
  await new Promise((r) => setTimeout(r, 2000));
  const reference = JSON.stringify(clients[0].log.toJSON());
  const converged = clients.every((c) => JSON.stringify(c.log.toJSON()) === reference);

  latencies.sort((a, b) => a - b);
  const finalHealth = await (await fetch(`${COLLAB_HTTP}/health`)).json();
  const result = {
    clients: CLIENTS,
    seconds: SECONDS,
    edits: sent,
    deliveries: latencies.length,
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: latencies.at(-1) ?? 0,
    },
    converged,
    serverRssMb: { peak: Math.max(0, ...memory, finalHealth.rssMb ?? 0), last: finalHealth.rssMb },
    serverConnections: finalHealth.connections,
  };
  console.log(JSON.stringify(result, null, 2));

  for (const c of clients) {
    c.provider.destroy();
    c.socket.destroy();
  }
  return result;
}

let failed = false;
try {
  const result = await main();
  if (!result.converged) failed = true;
} catch (error) {
  console.error(error);
  failed = true;
} finally {
  await cleanup();
}
process.exit(failed ? 1 : 0);
