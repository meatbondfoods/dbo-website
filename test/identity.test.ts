import test from "node:test";
import assert from "node:assert/strict";
import { CUSTOMER_CODE_RE, ORDER_REF_RE, formatCustomerCode, formatOrderReference, normalizeBdPhone } from "../src/lib/identity.ts";

test("normalizeBdPhone: accepts the common Bangladesh formats and converges on E.164", () => {
  for (const raw of ["01712345678", "+8801712345678", "8801712345678", "017-1234 5678", " +880 1712-345678 "]) {
    assert.equal(normalizeBdPhone(raw), "+8801712345678", raw);
  }
});

test("normalizeBdPhone: rejects numbers that are not Bangladesh mobiles", () => {
  for (const raw of ["", "123", "01212345678", "0171234567", "+919876543210", "01712345678901", "abc"]) {
    assert.equal(normalizeBdPhone(raw), null, raw);
  }
});

test("customer codes are zero-padded, validated, and reject non-positive sequences", () => {
  assert.equal(formatCustomerCode(1), "MBM-CUS-000001");
  assert.equal(formatCustomerCode(123456), "MBM-CUS-123456");
  assert.equal(formatCustomerCode(1234567), "MBM-CUS-1234567"); // grows past 6 digits, never truncates
  assert.match(formatCustomerCode(42), CUSTOMER_CODE_RE);
  assert.throws(() => formatCustomerCode(0));
  assert.throws(() => formatCustomerCode(1.5));
  assert.equal(CUSTOMER_CODE_RE.test("MBM-CUS-12"), false);
});

test("order references include the year and a zero-padded sequence", () => {
  assert.equal(formatOrderReference(2026, 1), "MBM-ORD-2026-000001");
  assert.match(formatOrderReference(2027, 99), ORDER_REF_RE);
  assert.throws(() => formatOrderReference(26, 1));
  assert.throws(() => formatOrderReference(2026, 0));
  assert.equal(ORDER_REF_RE.test("MM-2026-0001"), false); // the old demo format must not validate
});
