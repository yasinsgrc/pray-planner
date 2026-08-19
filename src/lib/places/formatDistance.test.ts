import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDistance } from "./formatDistance";

test("formatDistance shows whole meters below 1 km", () => {
  assert.equal(formatDistance(350), "350 m");
});

test("formatDistance shows one-decimal comma-formatted km at or above 1 km", () => {
  assert.equal(formatDistance(2400), "2,4 km");
});

test("formatDistance rounds meters near the km boundary into the km branch", () => {
  assert.equal(formatDistance(999.6), "1,0 km");
});

test("formatDistance rounds meters below the boundary as meters", () => {
  assert.equal(formatDistance(999.4), "999 m");
});
