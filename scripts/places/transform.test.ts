import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPlace, isNotable, resolvePlaceName, transform, type OsmData } from "./transform";

// --- classifyPlace: turbe ---

test("classifyPlace turbe icin historic=tomb doner, isim sartı yok", () => {
  assert.equal(classifyPlace({ historic: "tomb" }), "turbe");
});

test("classifyPlace turbe icin building=mausoleum doner, isim sartı yok", () => {
  assert.equal(classifyPlace({ building: "mausoleum" }), "turbe");
});

test("classifyPlace turbe icin isimliyken de calisir (regresyon)", () => {
  assert.equal(classifyPlace({ name: "Eyüp Sultan Türbesi", historic: "tomb" }), "turbe");
  assert.equal(classifyPlace({ name: "Anıtkabir", building: "mausoleum" }), "turbe");
});

// --- classifyPlace: cami ---

test("classifyPlace building=mosque icin cami doner, isim sartı yok", () => {
  assert.equal(classifyPlace({ building: "mosque" }), "cami");
});

test("classifyPlace amenity=place_of_worship + religion=muslim icin cami doner, isim sartı yok", () => {
  assert.equal(classifyPlace({ amenity: "place_of_worship", religion: "muslim" }), "cami");
});

test("classifyPlace amenity=place_of_worship + religion yok + isim CAMI_NAME_PATTERN'a uyuyorsa cami doner", () => {
  assert.equal(classifyPlace({ name: "Yeni Camii", amenity: "place_of_worship" }), "cami");
  assert.equal(classifyPlace({ name: "Köy Mescidi", amenity: "place_of_worship" }), "cami");
  assert.equal(classifyPlace({ name: "Sokak Mescit", amenity: "place_of_worship" }), "cami");
});

test("classifyPlace jenerik isimli kayitlari artik null'a cevirmez (dusme isi resolvePlaceName'de)", () => {
  assert.equal(classifyPlace({ name: "Cami", amenity: "place_of_worship", religion: "muslim" }), "cami");
  assert.equal(classifyPlace({ name: "CAMİ", building: "mosque" }), "cami");
});

// --- classifyPlace: kesin dislama (religion != muslim) ---

test("classifyPlace amenity=place_of_worship + religion != muslim ise isimsizken de null doner", () => {
  assert.equal(classifyPlace({ amenity: "place_of_worship", religion: "christian" }), null);
  assert.equal(classifyPlace({ amenity: "place_of_worship", religion: "jewish" }), null);
});

test("classifyPlace amenity=place_of_worship + religion != muslim ise isimliyken de null doner (regresyon)", () => {
  assert.equal(classifyPlace({ name: "Ayasofya", amenity: "place_of_worship", religion: "christian" }), null);
  assert.equal(
    classifyPlace({ name: "Neve Şalom Camii", amenity: "place_of_worship", religion: "jewish" }),
    null,
  );
});

// --- classifyPlace: belirsiz durumlar (dislama KORUNACAK) ---

test("classifyPlace building=yes + amenity=place_of_worship (religion yok, isim yok) icin null doner", () => {
  assert.equal(classifyPlace({ building: "yes", amenity: "place_of_worship" }), null);
});

test("classifyPlace tek basina amenity=place_of_worship (religion yok, isim yok) icin null doner", () => {
  assert.equal(classifyPlace({ amenity: "place_of_worship" }), null);
});

test("classifyPlace amenity=place_of_worship + religion yok + isim desene uymuyorsa null doner", () => {
  assert.equal(classifyPlace({ name: "Bilinmeyen İbadethane", amenity: "place_of_worship" }), null);
});

test("classifyPlace ilgisiz taglerde null doner", () => {
  assert.equal(classifyPlace({ name: "Bir Yer", amenity: "restaurant" }), null);
  assert.equal(classifyPlace({ amenity: "restaurant" }), null);
});

// --- resolvePlaceName: jenerik isimler dusuruluyor (kayit ELENMIYOR, sadece isim alanı) ---

test("resolvePlaceName isim yoksa undefined doner", () => {
  assert.equal(resolvePlaceName(undefined), undefined);
});

test("resolvePlaceName jenerik isimler icin undefined doner (cami, camii, mescit, mescid)", () => {
  assert.equal(resolvePlaceName("Cami"), undefined);
  assert.equal(resolvePlaceName(" Camii "), undefined);
  assert.equal(resolvePlaceName("MESCIT"), undefined);
  assert.equal(resolvePlaceName("mescid"), undefined);
});

test("resolvePlaceName Turkce buyuk harf jenerik isimleri filtreler (İ/I edge case)", () => {
  assert.equal(resolvePlaceName("CAMİ"), undefined);
  assert.equal(resolvePlaceName("MESCİT"), undefined);
  assert.equal(resolvePlaceName("Camii"), undefined);
});

test("resolvePlaceName jenerik olmayan isimleri aynen doner", () => {
  assert.equal(resolvePlaceName("Fatih Camii"), "Fatih Camii");
  assert.equal(resolvePlaceName("Sultanahmet Camii"), "Sultanahmet Camii");
});

// --- isNotable (degismedi) ---

test("isNotable returns true when wikidata tag is present", () => {
  assert.equal(isNotable({ wikidata: "Q1234" }), true);
});

test("isNotable returns true when wikipedia tag is present", () => {
  assert.equal(isNotable({ wikipedia: "tr:Sultanahmet Camii" }), true);
});

test("isNotable returns false when neither wikidata nor wikipedia is present", () => {
  assert.equal(isNotable({ name: "Bir Yer" }), false);
});

// --- transform: isimsiz kayitlar artik tutuluyor, n alanı hic yazılmıyor ---

test("transform isimsiz cami kaydini tutar, n alanini hic yazmaz", () => {
  const data: OsmData = {
    elements: [{ type: "way", id: 1, center: { lat: 41.0, lon: 29.0 }, tags: { building: "mosque" } }],
  };
  const result = transform(data);
  assert.deepEqual(result, { "410_290": [{ y: 41, x: 29, c: 0 }] });
  assert.ok(!("n" in result["410_290"][0]));
});

test("transform jenerik isimli kaydi tutar ama n alanini yazmaz", () => {
  const data: OsmData = {
    elements: [
      {
        type: "node",
        id: 2,
        lat: 41.0,
        lon: 29.0,
        tags: { name: "Cami", amenity: "place_of_worship", religion: "muslim" },
      },
    ],
  };
  const result = transform(data);
  assert.deepEqual(result, { "410_290": [{ y: 41, x: 29, c: 0 }] });
});

// --- transform: mevcut regresyon testleri ---

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

// --- transform dedup: isimsiz + isimli, ayni kategori, <50m -> isimsiz olan elenir ---

test("transform isimsiz+isimli ayni kategori <50m ise isimsiz olan elenir (isimsiz once gelirse)", () => {
  const data: OsmData = {
    elements: [
      { type: "way", id: 1, center: { lat: 41.0, lon: 29.0 }, tags: { building: "mosque" } },
      {
        type: "node",
        id: 2,
        lat: 41.0001,
        lon: 29.0001,
        tags: { name: "Fatih Camii", building: "mosque" },
      },
    ],
  };
  assert.deepEqual(transform(data), {
    "410_290": [{ n: "Fatih Camii", y: 41.0001, x: 29.0001, c: 0 }],
  });
});

test("transform isimli+isimsiz ayni kategori <50m ise isimsiz olan elenir (isimli once gelirse)", () => {
  const data: OsmData = {
    elements: [
      {
        type: "node",
        id: 1,
        lat: 41.0,
        lon: 29.0,
        tags: { name: "Fatih Camii", building: "mosque" },
      },
      { type: "way", id: 2, center: { lat: 41.0001, lon: 29.0001 }, tags: { building: "mosque" } },
    ],
  };
  assert.deepEqual(transform(data), {
    "410_290": [{ n: "Fatih Camii", y: 41, x: 29, c: 0 }],
  });
});

// --- transform dedup: isimsiz + isimsiz, ayni kategori, <50m -> biri elenir ---

test("transform isimsiz+isimsiz ayni kategori <50m ise biri elenir", () => {
  const data: OsmData = {
    elements: [
      { type: "way", id: 1, center: { lat: 41.0, lon: 29.0 }, tags: { building: "mosque" } },
      { type: "way", id: 2, center: { lat: 41.0001, lon: 29.0001 }, tags: { building: "mosque" } },
    ],
  };
  assert.deepEqual(transform(data), { "410_290": [{ y: 41, x: 29, c: 0 }] });
});

test("transform isimsiz kayitlar farkli kategorideyse (cami/turbe) elenmez", () => {
  const data: OsmData = {
    elements: [
      { type: "way", id: 1, center: { lat: 41.0, lon: 29.0 }, tags: { building: "mosque" } },
      { type: "way", id: 2, center: { lat: 41.0001, lon: 29.0001 }, tags: { building: "mausoleum" } },
    ],
  };
  assert.deepEqual(transform(data), {
    "410_290": [
      { y: 41, x: 29, c: 0 },
      { y: 41.0001, x: 29.0001, c: 1 },
    ],
  });
});

test("transform isimsiz+isimsiz 50m esigi disinda (ama 100m icinde) ise ikisi de kalir", () => {
  const data: OsmData = {
    elements: [
      { type: "way", id: 1, center: { lat: 41.0, lon: 29.0 }, tags: { building: "mosque" } },
      { type: "way", id: 2, center: { lat: 41.0006, lon: 29.0 }, tags: { building: "mosque" } },
    ],
  };
  assert.deepEqual(transform(data), {
    "410_290": [
      { y: 41, x: 29, c: 0 },
      { y: 41.0006, x: 29, c: 0 },
    ],
  });
});
