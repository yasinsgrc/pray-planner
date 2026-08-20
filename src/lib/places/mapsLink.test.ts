import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGoogleMapsUrl } from "./mapsLink.ts";

test("buildGoogleMapsUrl encodes name and coordinates into a Google Maps search URL", () => {
  const url = buildGoogleMapsUrl("Sultan Ahmet Camii", 41.0054, 28.9768);
  assert.equal(
    url,
    "https://www.google.com/maps/search/?api=1&query=Sultan%20Ahmet%20Camii%2041.0054%2C28.9768"
  );
});

test("buildGoogleMapsUrl encodes special characters in the place name", () => {
  const url = buildGoogleMapsUrl("Şehzade & Camii", 40.5, 29.5);
  assert.ok(url.startsWith("https://www.google.com/maps/search/?api=1&query="));
  assert.ok(!url.includes("&Camii"));
});
