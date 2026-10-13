// Every random choice in a Corporate Luck by Chance game comes from the public randomness beacon (the same kind of source the other Corporate Games use),
// never from a server and never from a person. Here a beacon value is just a string passed in; `label` separates the different draws made from one value.
// This is the same stream / rejection-sampling construction the Corporate Tic Tac Toe game uses (its random.ts), kept as its own copy so this product builds and tests alone.

const enc = new TextEncoder();
const hex = (b: ArrayBuffer): string => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
export const sha256Hex = async (s: string): Promise<string> => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));

/** A deterministic stream of 32-bit numbers from (seed, label). Same input, same stream, on every device. */
export async function stream(seed: string, label: string, count: number): Promise<number[]> {
  const out: number[] = [];
  for (let block = 0; out.length < count; block++) {
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`${seed}|${label}|${block}`)));
    for (let i = 0; i + 4 <= h.length && out.length < count; i += 4) out.push(((h[i]! << 24) | (h[i + 1]! << 16) | (h[i + 2]! << 8) | h[i + 3]!) >>> 0);
  }
  return out;
}

/** An unbiased integer in [0, n) by rejection sampling over the stream. */
export async function below(seed: string, label: string, n: number): Promise<number> {
  const limit = Math.floor(0x100000000 / n) * n;
  for (let k = 0; ; k++) { const v = (await stream(seed, `${label}#${k}`, 1))[0]!; if (v < limit) return v % n; }
}
