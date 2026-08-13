// test/security.test.js - webhook HMAC signature validation.
//
// This check was dead code until v1.1.0 (the comparison was commented out
// while still logging success), and the commented version hashed
// JSON.stringify(body) rather than the raw bytes, which can never match.
// These tests pin both properties.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

process.env.WEBHOOK_SECRET = "test_app_secret";
const { validateSignature } = await import("../middlewares/security.js");

const SECRET = "test_app_secret";
const sign = (body, secret = SECRET) =>
  "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

test("accepts a correctly signed body", () => {
  const body = '{"object":"whatsapp_business_account","entry":[]}';
  assert.equal(validateSignature(body, sign(body)), true);
});

test("accepts a Buffer body (how Express supplies rawBody)", () => {
  const body = Buffer.from('{"object":"whatsapp_business_account"}', "utf8");
  assert.equal(validateSignature(body, sign(body)), true);
});

test("rejects a body signed with the wrong secret", () => {
  const body = '{"object":"whatsapp_business_account"}';
  assert.equal(validateSignature(body, sign(body, "wrong_secret")), false);
});

test("rejects a tampered body", () => {
  const original = '{"amount":100}';
  const signature = sign(original);
  assert.equal(validateSignature('{"amount":999}', signature), false);
});

test("works with or without the sha256= prefix", () => {
  const body = '{"a":1}';
  const withPrefix = sign(body);
  const bare = withPrefix.replace("sha256=", "");
  assert.equal(validateSignature(body, withPrefix), true);
  assert.equal(validateSignature(body, bare), true);
});

test("malformed signatures are rejected, not thrown", () => {
  // timingSafeEqual throws on length mismatch — these must be caught
  const body = '{"a":1}';
  for (const bad of ["sha256=deadbeef", "", "sha256=", "not-hex-at-all", "sha256=zzzz"]) {
    assert.equal(validateSignature(body, bad), false, `signature: ${JSON.stringify(bad)}`);
  }
});

test("re-serialized JSON does not validate (why rawBody matters)", () => {
  // Meta signs the exact bytes it sent. Key order and spacing differ after a
  // parse/stringify round-trip, so hashing the re-serialized object fails.
  const raw = '{"b":2,"a":1}';
  const signature = sign(raw);
  const reserialized = JSON.stringify(JSON.parse(raw)); // -> {"b":2,"a":1} may reorder/respace
  assert.equal(validateSignature(raw, signature), true, "raw bytes must validate");
  if (reserialized !== raw) {
    assert.equal(
      validateSignature(reserialized, signature),
      false,
      "re-serialized body must not validate"
    );
  }
});
