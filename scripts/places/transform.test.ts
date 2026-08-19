import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPlace, isNotable } from "./transform";

test("classifyPlace returns turbe for historic=tomb with a name", () => {
  assert.equal(classifyPlace({ name: "Eyüp Sultan Türbesi", historic: "tomb" }), "turbe");
});

test("classifyPlace returns turbe for building=mausoleum with a name", () => {
  assert.equal(classifyPlace({ name: "Anıtkabir", building: "mausoleum" }), "turbe");
});

test("classifyPlace returns cami for amenity=place_of_worship + religion=muslim with a name", () => {
  assert.equal(
    classifyPlace({ name: "Sultanahmet Camii", amenity: "place_of_worship", religion: "muslim" }),
    "cami",
  );
});

test("classifyPlace returns null when amenity=place_of_worship but religion is not muslim", () => {
  assert.equal(
    classifyPlace({ name: "Ayasofya", amenity: "place_of_worship", religion: "christian" }),
    null,
  );
});

test("classifyPlace returns null when no name is present, even if tags otherwise match", () => {
  assert.equal(classifyPlace({ historic: "tomb" }), null);
  assert.equal(classifyPlace({ amenity: "place_of_worship", religion: "muslim" }), null);
});

test("classifyPlace returns null when no relevant tags match", () => {
  assert.equal(classifyPlace({ name: "Bir Yer", amenity: "restaurant" }), null);
});

test("isNotable returns true when wikidata tag is present", () => {
  assert.equal(isNotable({ wikidata: "Q1234" }), true);
});

test("isNotable returns true when wikipedia tag is present", () => {
  assert.equal(isNotable({ wikipedia: "tr:Sultanahmet Camii" }), true);
});

test("isNotable returns false when neither wikidata nor wikipedia is present", () => {
  assert.equal(isNotable({ name: "Bir Yer" }), false);
});
