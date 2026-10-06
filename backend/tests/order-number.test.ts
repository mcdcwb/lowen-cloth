import test from "node:test";
import assert from "node:assert/strict";
import { orderNumber } from "../src/lib/order-number.js";
test("global sequence, month/year boundaries, Brazil timezone and explicit limit", () => {
  assert.equal(orderNumber(1, new Date("2026-10-01T03:00:00Z")), "26100001");
  assert.equal(orderNumber(2, new Date("2026-10-02T03:00:00Z")), "26100002");
  assert.equal(orderNumber(51, new Date("2026-11-01T02:30:00Z")), "26100051");
  assert.equal(orderNumber(52, new Date("2026-11-01T03:00:00Z")), "26110052");
  assert.equal(orderNumber(81, new Date("2026-12-01T03:00:00Z")), "26120081");
  assert.equal(orderNumber(82, new Date("2027-01-01T02:30:00Z")), "26120082");
  assert.equal(orderNumber(9999, new Date("2026-10-01T03:00:00Z")), "26109999");
  for (const value of [0, 10000, -1, 1.5]) assert.throws(() => orderNumber(value, new Date()), RangeError);
});
