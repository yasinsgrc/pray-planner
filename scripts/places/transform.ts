import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bucketKey } from "../../src/lib/places/geo";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_PATH = path.join(__dirname, ".cache", "osm-raw.json");
const OUTPUT_PATH = path.join(__dirname, "..", "..", "src", "assets", "places", "index.json");

export type PlaceKind = "cami" | "turbe";
const KIND_CODE: Record<PlaceKind, 0 | 1> = { cami: 0, turbe: 1 };

export type OsmTags = Record<string, string | undefined>;

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
}

export interface OsmData {
  elements: OsmElement[];
}

export interface PlaceEntry {
  n?: string;
  y: number;
  x: number;
  c: 0 | 1;
  w?: 1;
}

const GENERIC_NAMES = new Set(["cami", "camii", "mescit", "mescid"]);
const CAMI_NAME_PATTERN = /[CcÇç]ami|[Mm]escit|[Mm]escid/;

function normalizeName(name: string): string {
  return name.trim().replace(/İ/g, "i").toLowerCase().normalize("NFC");
}

export function resolvePlaceName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  if (GENERIC_NAMES.has(normalizeName(name))) return undefined;
  return name;
}

export function classifyPlace(tags: OsmTags): PlaceKind | null {
  if (tags.historic === "tomb" || tags.building === "mausoleum") return "turbe";
  if (tags.amenity === "place_of_worship" && tags.religion && tags.religion !== "muslim") return null;
  if (tags.building === "mosque") return "cami";
  if (tags.amenity === "place_of_worship" && tags.religion === "muslim") return "cami";
  if (tags.amenity === "place_of_worship" && !tags.religion && tags.name && CAMI_NAME_PATTERN.test(tags.name))
    return "cami";
  return null;
}

export function isNotable(tags: OsmTags): boolean {
  return Boolean(tags.wikidata || tags.wikipedia);
}

function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

const DEDUPE_NAMED_DEGREE_THRESHOLD = 100 / 111_320; // ~100m, basit derece farkı
const DEDUPE_UNNAMED_DEGREE_THRESHOLD = 50 / 111_320; // ~50m, basit derece farkı

function isNear(a: PlaceEntry, b: PlaceEntry, thresholdDeg: number): boolean {
  return Math.abs(a.y - b.y) < thresholdDeg && Math.abs(a.x - b.x) < thresholdDeg;
}

// İsimsiz bina poligonu genelde isimli node'u içerir, bu yüzden isimli+isimsiz
// çakışmasında isimsiz olan her zaman elenir (hangisi önce geldiğinden bağımsız).
function addEntry(bucket: PlaceEntry[], entry: PlaceEntry): void {
  if (entry.n) {
    const isDuplicateNamed = bucket.some(
      (other) => other.n === entry.n && isNear(other, entry, DEDUPE_NAMED_DEGREE_THRESHOLD),
    );
    if (isDuplicateNamed) return;

    for (let i = bucket.length - 1; i >= 0; i--) {
      const other = bucket[i];
      if (!other.n && other.c === entry.c && isNear(other, entry, DEDUPE_UNNAMED_DEGREE_THRESHOLD)) {
        bucket.splice(i, 1);
      }
    }
    bucket.push(entry);
    return;
  }

  const hasNamedNeighbor = bucket.some(
    (other) => other.n && other.c === entry.c && isNear(other, entry, DEDUPE_UNNAMED_DEGREE_THRESHOLD),
  );
  if (hasNamedNeighbor) return;

  const isDuplicateUnnamed = bucket.some(
    (other) => !other.n && other.c === entry.c && isNear(other, entry, DEDUPE_UNNAMED_DEGREE_THRESHOLD),
  );
  if (isDuplicateUnnamed) return;

  bucket.push(entry);
}

function elementCoords(element: OsmElement): { lat: number; lon: number } | null {
  if (element.lat !== undefined && element.lon !== undefined) {
    return { lat: element.lat, lon: element.lon };
  }
  if (element.center) {
    return element.center;
  }
  return null;
}

export function transform(data: OsmData): Record<string, PlaceEntry[]> {
  const buckets: Record<string, PlaceEntry[]> = {};

  for (const element of data.elements) {
    const tags = element.tags ?? {};
    const kind = classifyPlace(tags);
    if (!kind) continue;

    const coords = elementCoords(element);
    if (!coords) continue;

    const y = round5(coords.lat);
    const x = round5(coords.lon);
    const name = resolvePlaceName(tags.name);
    const entry: PlaceEntry = { y, x, c: KIND_CODE[kind] };
    if (name) entry.n = name;
    if (isNotable(tags)) entry.w = 1;

    const key = bucketKey(y, x);
    const bucket = (buckets[key] ??= []);
    addEntry(bucket, entry);
  }

  return buckets;
}

async function main() {
  const raw = await readFile(INPUT_PATH, "utf-8");
  const data: OsmData = JSON.parse(raw);
  const index = transform(data);

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(index), "utf-8");

  console.log(`Yazıldı: ${OUTPUT_PATH}`);
}

const isMainModule = path.resolve(process.argv[1] ?? "") === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
