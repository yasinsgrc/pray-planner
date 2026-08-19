import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPlace, isNotable, transform, type OsmData } from "./transform";

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

test("transform gruplar OSM elemanlarını bucket'lara, uygun olmayanları eler", () => {
  const data: OsmData = {
    elements: [
      {
        type: "node",
        id: 1,
        lat: 41.008614,
        lon: 28.980199,
        tags: {
          name: "Sultanahmet Camii",
          amenity: "place_of_worship",
          religion: "muslim",
          wikidata: "Q179370",
        },
      },
      {
        type: "way",
        id: 2,
        center: { lat: 34.1, lon: 28.2 },
        tags: { name: "Test Türbesi", historic: "tomb" },
      },
      {
        type: "node",
        id: 3,
        lat: 39.5,
        lon: 30.1,
        tags: { name: "Bir Lokanta", amenity: "restaurant" },
      },
    ],
  };

  assert.deepEqual(transform(data), {
    "410_289": [{ n: "Sultanahmet Camii", y: 41.00861, x: 28.9802, c: 0, w: 1 }],
    "341_282": [{ n: "Test Türbesi", y: 34.1, x: 28.2, c: 1 }],
  });
});
