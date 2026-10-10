/**
 * UUID v7: a millisecond timestamp prefix, then random bits. IDs created on a device sort by
 * creation time and keep working offline (CLAUDE.md: client-generated v7 ids).
 */
export function uuidv7(now: number = Date.now(), random?: Uint8Array): string {
  const bytes = random ?? globalThis.crypto.getRandomValues(new Uint8Array(16));
  if (bytes.length < 16) throw new Error("need 16 random bytes");

  // 48 bit big-endian millisecond timestamp
  let ts = BigInt(now);
  for (let i = 5; i >= 0; i--) {
    bytes[i] = Number(ts & 0xffn);
    ts >>= 8n;
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant

  const hex = Array.from(bytes.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
