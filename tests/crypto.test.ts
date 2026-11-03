import assert from "node:assert/strict";
import { decrypt, encrypt, isEncrypted } from "../lib/crypto.ts";

const secret = "test-secret-key";
const token = "0123456789abcdef0123456789abcdef01234567";

const sealed = encrypt(token, secret);
assert.ok(isEncrypted(sealed), "output is marked as encrypted");
assert.ok(!sealed.includes(token), "token does not appear in stored value");
assert.equal(decrypt(sealed, secret), token, "round-trips");
assert.notEqual(encrypt(token, secret), sealed, "fresh IV each time");
assert.throws(() => decrypt(sealed, "wrong-key"), "wrong key fails");
const tampered = sealed.slice(0, -4) + (sealed.endsWith("AAAA") ? "BBBB" : "AAAA");
assert.throws(() => decrypt(tampered, secret), "tampering is detected");
assert.equal(decrypt(token, secret), token, "legacy plaintext still readable for migration");

console.log("all crypto tests passed");
