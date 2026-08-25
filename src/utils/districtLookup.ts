export interface ResolvedDistrict {
  il: string;
  ilce: string;
}

interface EncodedDistrict {
  il: string;
  ilce: string;
  bbox: [number, number, number, number];
  rings: number[][];
}

interface DistrictBoundariesFile {
  version: number;
  attribution: string;
  districts: EncodedDistrict[];
}

interface DecodedDistrict {
  il: string;
  ilce: string;
  bbox: [number, number, number, number];
  rings: Array<Array<[number, number]>>;
}

let decodedDistrictsPromise: Promise<DecodedDistrict[]> | null = null;

function decodeRing(flat: number[]): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let lat = 0;
  let lon = 0;
  for (let i = 0; i < flat.length; i += 2) {
    if (i === 0) {
      lat = flat[0];
      lon = flat[1];
    } else {
      lat += flat[i];
      lon += flat[i + 1];
    }
    points.push([lat / 1e5, lon / 1e5]);
  }
  return points;
}

async function loadDecodedDistricts(): Promise<DecodedDistrict[]> {
  if (!decodedDistrictsPromise) {
    decodedDistrictsPromise = import('../data/districtBoundaries.json').then((mod) => {
      const file = (mod.default ?? mod) as unknown as DistrictBoundariesFile;
      return file.districts.map((d) => ({
        il: d.il,
        ilce: d.ilce,
        bbox: d.bbox,
        rings: d.rings.map(decodeRing),
      }));
    });
  }
  return decodedDistrictsPromise;
}

function bboxContains(bbox: [number, number, number, number], lat: number, lng: number): boolean {
  const [minLat, minLng, maxLat, maxLng] = bbox;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

// Standart even-odd point-in-polygon (ray casting). Bir district'in tüm
// ring'leri (outer + inner delik) sırayla XOR'lanır: bu, hangi ring'in
// outer/hangisinin inner olduğunu bilmeye gerek kalmadan "outer içinde VE
// hiçbir inner içinde değil" sonucunu verir (SVG evenodd fill-rule ile aynı
// mantık) — çünkü build-district-boundaries.mjs ring'leri outer/inner
// ayrımını korumadan tek bir düz diziye yazıyor.
function pointInRing(lat: number, lng: number, ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lngI] = ring[i];
    const [latJ, lngJ] = ring[j];
    const intersects =
      lngI > lng !== lngJ > lng && lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInDistrict(lat: number, lng: number, district: DecodedDistrict): boolean {
  let inside = false;
  for (const ring of district.rings) {
    if (pointInRing(lat, lng, ring)) inside = !inside;
  }
  return inside;
}

export async function resolveDistrict(lat: number, lng: number): Promise<ResolvedDistrict | null> {
  const districts = await loadDecodedDistricts();
  for (const district of districts) {
    if (!bboxContains(district.bbox, lat, lng)) continue;
    if (pointInDistrict(lat, lng, district)) {
      return { il: district.il, ilce: district.ilce };
    }
  }
  return null;
}
