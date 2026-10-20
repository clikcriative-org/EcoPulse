// Self-check: auth keys must stay distinct under MySQL's case-insensitive collation. Run: npx tsx scripts/test-auth-key.ts
import assert from "node:assert/strict";
import { authKey } from "../src/modules/whatsapp/auth/usePrismaAuthState";

const ids = ["AAAAAFkE", "AAAAAFke", "ABwAAFkl", "ABwAAFkL", "aaaaafke"];
const keys = ids.map(id => authKey("app-state-sync-key", id));
assert.equal(new Set(keys.map(k => k.toLowerCase())).size, ids.length, "colisão sem diferenciar maiúsculas");
assert.equal(authKey("creds", "me"), "creds-me", "chaves sem maiúsculas não mudam");
assert.equal(authKey("session", "5521999999999.0"), "session-5521999999999.0");
assert.equal(authKey("app-state-sync-version", "regular_high"), "app-state-sync-version-regular_high");
console.log("auth key: all checks passed");
