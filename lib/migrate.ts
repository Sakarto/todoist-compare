// One-time cleanup: the previous version stored (encrypted) tokens. Use each one a final time
// to move that person onto the new token-free board, then delete every stored token.
import { run } from "./kv.ts";
import { decrypt } from "./crypto.ts";
import { readOnce } from "./stats.ts";
import { join } from "./board.ts";

const LEGACY = "todoist-compare:members";

export async function migrateLegacy() {
  const [v] = await run([["GET", LEGACY]]);
  if (!v) return;
  let members: { name: string; token: string }[] = [];
  try { members = JSON.parse(String(v)); } catch {}
  for (const m of members) {
    try {
      const { user, seed } = await readOnce(decrypt(m.token));
      await join(m.name, user, seed);
    } catch {
      // Token can't be decrypted or was revoked: that person just signs in again.
    }
  }
  await run([["DEL", LEGACY]]);
}
