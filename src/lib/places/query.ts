import { haversineDistanceKm } from "../../utils/geo";
import { neighborBuckets } from "./geo";

export interface PlaceEntry {
  n?: string;
  y: number;
  x: number;
  c: 0 | 1;
  w?: 1;
}

export type PlaceIndex = Record<string, PlaceEntry[]>;

export type PlaceCategory = "cami" | "turbe" | "tarihi";

export interface Place {
  name: string | null;
  lat: number;
  lon: number;
  distanceMeters: number;
  category: "cami" | "turbe";
  notable: boolean;
}

const CATEGORY_CODE: Record<"cami" | "turbe", 0 | 1> = { cami: 0, turbe: 1 };

function matchesCategory(entry: PlaceEntry, category: PlaceCategory): boolean {
  if (category === "tarihi") return entry.w === 1;
  return entry.c === CATEGORY_CODE[category];
}

export function findNearby(
  index: PlaceIndex,
  lat: number,
  lon: number,
  category: PlaceCategory,
  limit = 30,
): Place[] {
  const results: Place[] = [];

  for (const key of neighborBuckets(lat, lon)) {
    const entries = index[key];
    if (!entries) continue;

    for (const entry of entries) {
      if (!matchesCategory(entry, category)) continue;
      results.push({
        name: entry.n ?? null,
        lat: entry.y,
        lon: entry.x,
        distanceMeters: haversineDistanceKm(lat, lon, entry.y, entry.x) * 1000,
        category: entry.c === 0 ? "cami" : "turbe",
        notable: entry.w === 1,
      });
    }
  }

  results.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return results.slice(0, limit);
}
