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

test("classifyPlace returns cami for building=mosque with a name (religion tag olmadan)", () => {
  assert.equal(classifyPlace({ name: "Fatih Camii", building: "mosque" }), "cami");
});

test("classifyPlace returns cami for amenity=place_of_worship + religion yok + name Camii/Mescit/Mescid deseni", () => {
  assert.equal(classifyPlace({ name: "Yeni Camii", amenity: "place_of_worship" }), "cami");
  assert.equal(classifyPlace({ name: "Köy Mescidi", amenity: "place_of_worship" }), "cami");
  assert.equal(classifyPlace({ name: "Sokak Mescit", amenity: "place_of_worship" }), "cami");
});

test("classifyPlace returns null for amenity=place_of_worship + religion yok + isim desene uymuyor", () => {
  assert.equal(classifyPlace({ name: "Bilinmeyen İbadethane", amenity: "place_of_worship" }), null);
});

test("classifyPlace returns null for amenity=place_of_worship + religion=christian|jewish (KESİN dışla)", () => {
  assert.equal(
    classifyPlace({ name: "Ayasofya", amenity: "place_of_worship", religion: "christian" }),
    null,
  );
  assert.equal(
    classifyPlace({ name: "Neve Şalom Camii", amenity: "place_of_worship", religion: "jewish" }),
    null,
  );
});

test("classifyPlace jenerik isimler için null döner (cami, camii, mescit, mescid)", () => {
  assert.equal(classifyPlace({ name: "Cami", amenity: "place_of_worship", religion: "muslim" }), null);
  assert.equal(classifyPlace({ name: " Camii ", amenity: "place_of_worship", religion: "muslim" }), null);
  assert.equal(classifyPlace({ name: "MESCIT", amenity: "place_of_worship", religion: "muslim" }), null);
  assert.equal(classifyPlace({ name: "mescid", amenity: "place_of_worship", religion: "muslim" }), null);
});

test("transform aynı bucket'ta aynı isimli ve 100m'den yakın kayıtları eler (ilk gelen kalır)", () => {
  const data: OsmData = {
    elements: [
      {
        type: "node",
        id: 10,
        lat: 41.0,
        lon: 29.0,
        tags: { name: "Yakın Camii", amenity: "place_of_worship", religion: "muslim" },
      },
      {
        type: "node",
        id: 11,
        lat: 41.00045,
        lon: 29.0,
        tags: { name: "Yakın Camii", amenity: "place_of_worship", religion: "muslim" },
      },
      {
        type: "node",
        id: 12,
        lat: 41.0018,
        lon: 29.0,
        tags: { name: "Yakın Camii", amenity: "place_of_worship", religion: "muslim" },
      },
    ],
  };

  assert.deepEqual(transform(data), {
    "410_290": [
      { n: "Yakın Camii", y: 41, x: 29, c: 0 },
      { n: "Yakın Camii", y: 41.0018, x: 29, c: 0 },
    ],
  });
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
