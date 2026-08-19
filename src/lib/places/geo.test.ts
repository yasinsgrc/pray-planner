import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketKey, neighborBuckets } from "./geo";

test("bucketKey formats positive coordinates as lat_lon grid indices", () => {
  assert.equal(bucketKey(34.15, 28.32), "341_283");
});

test("bucketKey formats negative coordinates correctly", () => {
  assert.equal(bucketKey(-34.15, -28.32), "-342_-284");
});

test("bucketKey places a point exactly on a grid boundary into the upper cell", () => {
  assert.equal(bucketKey(34.1, 28.2), "341_282");
});

test("neighborBuckets returns 9 unique keys including the center cell", () => {
  const neighbors = neighborBuckets(34.15, 28.32);
  assert.equal(neighbors.length, 9);
  assert.equal(new Set(neighbors).size, 9);
  assert.ok(neighbors.includes(bucketKey(34.15, 28.32)));
});

test("neighborBuckets includes cells offset by exactly one grid step in each direction", () => {
  const neighbors = neighborBuckets(34.15, 28.32);
  assert.ok(neighbors.includes("342_284"));
  assert.ok(neighbors.includes("340_282"));
});

test("neighborBuckets works correctly for a point exactly on a grid boundary", () => {
  const neighbors = neighborBuckets(34.1, 28.2);
  assert.equal(neighbors.length, 9);
  assert.ok(neighbors.includes(bucketKey(34.1, 28.2)));
  assert.ok(neighbors.includes("342_283"));
  assert.ok(neighbors.includes("340_281"));
});
