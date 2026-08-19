export type PlaceKind = "cami" | "turbe";

export type OsmTags = Record<string, string | undefined>;

export function classifyPlace(tags: OsmTags): PlaceKind | null {
  if (!tags.name) return null;
  if (tags.historic === "tomb" || tags.building === "mausoleum") return "turbe";
  if (tags.amenity === "place_of_worship" && tags.religion === "muslim") return "cami";
  return null;
}

export function isNotable(tags: OsmTags): boolean {
  return Boolean(tags.wikidata || tags.wikipedia);
}
