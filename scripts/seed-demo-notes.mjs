// Demo content for the local stack: one scrap of every kind on dev@scraps.test's first space, so
// the board can be compared with the design artboards.
//
//   pnpm db:reset && pnpm dev           (stack and collab running)
//   node scripts/seed-demo-notes.mjs
//
// Notes are created through the collab server (real Yjs documents and previews); pictures and a
// short tone are generated here and uploaded with the service role key from apps/collab/.env.local.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

const env = loadEnv(new URL("../apps/collab/.env.local", import.meta.url));
const SUPABASE_URL = env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
const SECRET = env.INTERNAL_SECRET;
const COLLAB = process.env.COLLAB_URL ?? "http://localhost:1234";
if (!SERVICE_KEY || !SECRET)
  throw new Error("apps/collab/.env.local needs the service key and INTERNAL_SECRET");

const rest = async (path, init = {}) => {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res;
};

// ---- tiny generators -------------------------------------------------------------------------

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A flat-colour PNG with a lighter block, so cards have something to show. */
function png(width, height, [r, g, b], [r2, g2, b2]) {
  const row = width * 3 + 1;
  const raw = Buffer.alloc(row * height);
  for (let y = 0; y < height; y++) {
    raw[y * row] = 0;
    for (let x = 0; x < width; x++) {
      const inside = x > width * 0.2 && x < width * 0.6 && y > height * 0.35 && y < height * 0.8;
      const o = y * row + 1 + x * 3;
      raw[o] = inside ? r2 : r;
      raw[o + 1] = inside ? g2 : g;
      raw[o + 2] = inside ? b2 : b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** One second of a quiet 440 Hz tone as a WAV. */
function wav(seconds = 3) {
  const rate = 8000;
  const samples = rate * seconds;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const envelope = 0.4 + 0.3 * Math.sin((i / rate) * 3);
    data.writeInt16LE(
      Math.round(Math.sin((i / rate) * 2 * Math.PI * 440) * 9000 * envelope),
      i * 2,
    );
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// ---- who and where -------------------------------------------------------------------------

const users = await (await rest("/auth/v1/admin/users?per_page=100")).json();
const dev = users.users.find((u) => u.email === "dev@scraps.test");
if (!dev) throw new Error("dev@scraps.test not found; run pnpm db:reset first");
const spaces = await (
  await rest(
    `/rest/v1/spaces?owner_id=eq.${dev.id}&deleted_at=is.null&order=created_at&limit=1&select=id,name`,
  )
).json();
const space = spaces[0];
if (!space) throw new Error("dev has no space");
console.log(`seeding into "${space.name}" (${space.id})`);

async function createNote(body) {
  const res = await fetch(`${COLLAB}/notes`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-secret": SECRET },
    body: JSON.stringify({ spaceId: space.id, userId: dev.id, ...body }),
  });
  if (!res.ok) throw new Error(`POST /notes ${res.status} ${await res.text()}`);
}

async function upload(noteId, assetId, ext, mime, buffer, asset) {
  const path = `${noteId}/${assetId}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${path}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": mime,
      "x-upsert": "true",
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`upload ${res.status} ${await res.text()}`);
  await rest("/rest/v1/assets", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({
      id: assetId,
      note_id: noteId,
      space_id: space.id,
      uploader_id: dev.id,
      storage_path: path,
      mime,
      bytes: buffer.length,
      ...asset,
    }),
  });
  return path;
}

const id = () => randomUUID();
const palette = {
  sun: [
    [255, 214, 10],
    [255, 62, 165],
  ],
  night: [
    [159, 123, 255],
    [255, 214, 10],
  ],
  grass: [
    [166, 240, 0],
    [35, 64, 255],
  ],
};

// text
await createNote({
  id: id(),
  start: "text",
  title: "is the moon a notification light",
  text: "asking for a friend who stares at it at 3am\nwhat does it want from me",
});

// list
await createNote({
  id: id(),
  start: "list",
  title: "goa trip packing",
  items: ["sunscreen", "charger", "passport", "that one hat", "snacks"],
});

// quote
await createNote({ id: id(), start: "quote", text: "do it scared, then nap." });

// pic (single) and mood board
{
  const noteId = id();
  const assetId = id();
  const [a, b] = palette.sun;
  const path = `${noteId}/${assetId}.png`;
  await createNote({
    id: noteId,
    start: "image",
    title: "palolem, 6am",
    media: { assetId, path, width: 600, height: 450, color: "#ffd60a" },
  });
  await upload(noteId, assetId, "png", "image/png", png(600, 450, a, b), {
    kind: "image",
    width: 600,
    height: 450,
    dominant_color: "#ffd60a",
  });
}
{
  const noteId = id();
  const tiles = Object.values(palette).map((colors) => ({ assetId: id(), colors }));
  await createNote({
    id: noteId,
    start: "mood",
    title: "kitchen vibes",
    media: {
      images: tiles.map((t, i) => ({
        assetId: t.assetId,
        path: `${noteId}/${t.assetId}.png`,
        caption: ["sun", "night", "grass"][i],
      })),
    },
  });
  for (const t of tiles) {
    await upload(noteId, t.assetId, "png", "image/png", png(600, 450, t.colors[0], t.colors[1]), {
      kind: "image",
      width: 600,
      height: 450,
    });
  }
}

// link
await createNote({
  id: id(),
  start: "link",
  title: "the train timetable",
  media: {
    url: "https://example.com/trains",
    title: "Konkan railway timetable",
    description: "every train, every stop, none of the delays",
    domain: "example.com",
    mediaType: "article",
  },
});
await createNote({
  id: id(),
  start: "link",
  title: "watch later",
  media: {
    url: "https://youtu.be/dQw4w9WgXcQ",
    title: "a video worth three minutes",
    domain: "youtu.be",
    duration: 214,
    mediaType: "video",
  },
});

// voice
{
  const noteId = id();
  const assetId = id();
  const peaks = Array.from(
    { length: 64 },
    (_, i) => Math.round((0.3 + 0.7 * Math.abs(Math.sin(i / 5))) * 100) / 100,
  );
  await createNote({
    id: noteId,
    start: "voice",
    title: "shower thought",
    media: {
      assetId,
      path: `${noteId}/${assetId}.wav`,
      durationMs: 3000,
      peaks,
      authorId: dev.id,
      authorName: "dev",
    },
  });
  await upload(noteId, assetId, "wav", "audio/wav", wav(3), {
    kind: "audio",
    duration_ms: 3000,
    waveform: peaks,
    transcript_status: "none",
  });
}

console.log("done. refresh the board.");
