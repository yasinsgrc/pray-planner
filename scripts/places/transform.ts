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
  n: string;
  y: number;
  x: number;
  c: 0 | 1;
  w?: 1;
}

export function classifyPlace(tags: OsmTags): PlaceKind | null {
  if (!tags.name) return null;
  if (tags.historic === "tomb" || tags.building === "mausoleum") return "turbe";
  if (tags.amenity === "place_of_worship" && tags.religion === "muslim") return "cami";
  return null;
}

export function isNotable(tags: OsmTags): boolean {
  return Boolean(tags.wikidata || tags.wikipedia);
}

function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
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
    const entry: PlaceEntry = { n: tags.name as string, y, x, c: KIND_CODE[kind] };
    if (isNotable(tags)) entry.w = 1;

    const key = bucketKey(y, x);
    (buckets[key] ??= []).push(entry);
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
