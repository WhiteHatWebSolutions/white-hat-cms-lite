import test from "node:test";
import assert from "node:assert/strict";
import { zonedDateTime, zonedLocalToUtc } from "../lib/time.mjs";

test("publication time uses the configured zone before daylight-saving transition", () => {
  assert.deepEqual(zonedDateTime(new Date("2026-03-08T06:59:00Z"), "America/New_York"),
    { date: "2026-03-08", time: "01:59" });
});

test("publication time skips the missing hour at spring daylight-saving transition", () => {
  assert.deepEqual(zonedDateTime(new Date("2026-03-08T07:00:00Z"), "America/New_York"),
    { date: "2026-03-08", time: "03:00" });
});

test("publication date rolls over independently of UTC", () => {
  assert.deepEqual(zonedDateTime(new Date("2026-08-18T03:30:00Z"), "America/New_York"),
    { date: "2026-08-17", time: "23:30" });
});

test("local publication time converts to the correct UTC instant", () => {
  assert.equal(zonedLocalToUtc("2026-08-18", "09:15", "America/New_York").toISOString(), "2026-08-18T13:15:00.000Z");
  assert.equal(zonedLocalToUtc("2026-01-18", "09:15", "America/New_York").toISOString(), "2026-01-18T14:15:00.000Z");
});
