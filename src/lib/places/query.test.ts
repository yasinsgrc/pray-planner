import { test } from "node:test";
import assert from "node:assert/strict";
import { findNearby, type PlaceIndex } from "./query";
import { bucketKey } from "./geo";

const CENTER_LAT = 41.0;
const CENTER_LON = 29.0;

function buildIndex(): PlaceIndex {
  const key = bucketKey(CENTER_LAT, CENTER_LON);
  return {
    [key]: [
      { n: "Yakın Cami", y: 41.001, x: 29.001, c: 0 },
      { n: "Uzak Cami", y: 41.05, x: 29.05, c: 0 },
      { n: "Orta Cami", y: 41.01, x: 29.01, c: 0 },
      { n: "Türbe", y: 41.002, x: 29.002, c: 1 },
      { n: "Notable Cami", y: 41.003, x: 29.003, c: 0, w: 1 },
    ],
  };
}

test("findNearby sonuçları mesafeye göre artan sırada döner", () => {
  const index = buildIndex();
  const result = findNearby(index, CENTER_LAT, CENTER_LON, "cami");
  assert.deepEqual(
    result.map((p) => p.name),
    ["Yakın Cami", "Notable Cami", "Orta Cami", "Uzak Cami"],
  );
  for (let i = 1; i < result.length; i++) {
    assert.ok(result[i].distanceMeters >= result[i - 1].distanceMeters);
  }
});

test("findNearby kategori filtresi sadece istenen kategoriyi döner", () => {
  const index = buildIndex();

  const camiResults = findNearby(index, CENTER_LAT, CENTER_LON, "cami");
  assert.equal(camiResults.length, 4);
  assert.ok(camiResults.every((p) => p.category === "cami"));

  const turbeResults = findNearby(index, CENTER_LAT, CENTER_LON, "turbe");
  assert.equal(turbeResults.length, 1);
  assert.equal(turbeResults[0].name, "Türbe");
});

test("findNearby 'tarihi' kategorisi kategoriden bağımsız w===1 olanları döner", () => {
  const index = buildIndex();
  const result = findNearby(index, CENTER_LAT, CENTER_LON, "tarihi");
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Notable Cami");
});

test("findNearby limit parametresini uygular", () => {
  const index = buildIndex();
  const result = findNearby(index, CENTER_LAT, CENTER_LON, "cami", 2);
  assert.deepEqual(
    result.map((p) => p.name),
    ["Yakın Cami", "Notable Cami"],
  );
});

test("findNearby limit belirtilmezse varsayılan 30 kullanır", () => {
  const key = bucketKey(CENTER_LAT, CENTER_LON);
  const many = Array.from({ length: 40 }, (_, i) => ({
    n: `Cami ${i}`,
    y: CENTER_LAT + i * 0.0001,
    x: CENTER_LON,
    c: 0 as const,
  }));
  const index: PlaceIndex = { [key]: many };
  const result = findNearby(index, CENTER_LAT, CENTER_LON, "cami");
  assert.equal(result.length, 30);
});

test("findNearby isimsiz kayıtlar için name alanını null döner", () => {
  const key = bucketKey(CENTER_LAT, CENTER_LON);
  const index: PlaceIndex = {
    [key]: [{ y: 41.001, x: 29.001, c: 0 }],
  };
  const result = findNearby(index, CENTER_LAT, CENTER_LON, "cami");
  assert.equal(result.length, 1);
  assert.equal(result[0].name, null);
});

test("findNearby 9 hücre dışında kalan girdileri görmezden gelir ve halka genişletmez", () => {
  const farKey = bucketKey(CENTER_LAT + 1, CENTER_LON + 1);
  const index: PlaceIndex = {
    [farKey]: [{ n: "Çok Uzak Cami", y: CENTER_LAT + 1, x: CENTER_LON + 1, c: 0 }],
  };
  const result = findNearby(index, CENTER_LAT, CENTER_LON, "cami");
  assert.deepEqual(result, []);
});
