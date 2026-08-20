import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGoogleMapsUrl } from "./mapsLink.ts";

test("buildGoogleMapsUrl builds a coordinate-only Google Maps search URL", () => {
  const url = buildGoogleMapsUrl(41.0054, 28.9768);
  assert.equal(
    url,
    "https://www.google.com/maps/search/?api=1&query=41.0054,28.9768"
  );
});

test("buildGoogleMapsUrl does not include any free-text query beyond coordinates", () => {
  const url = buildGoogleMapsUrl(40.5, 29.5);
  assert.equal(url, "https://www.google.com/maps/search/?api=1&query=40.5,29.5");
});
