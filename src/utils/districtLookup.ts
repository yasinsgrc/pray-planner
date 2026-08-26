export interface ResolvedDistrict {
  il: string;
  ilce: string;
}

interface EncodedDistrict {
  il: string;
  ilce: string;
  bbox: [number, number, number, number];
  rings: string[];
}

interface DistrictBoundariesFile {
  version: number;
  attribution: string;
  districts: EncodedDistrict[];
}

const EXPECTED_VERSION = 2;

let rawDistrictsPromise: Promise<EncodedDistrict[]> | null = null;
const decodedRingsCache = new Map<number, Array<Array<[number, number]>>>();

// build-district-boundaries.mjs'teki zigzagEncode'un tersi.
function zigzagDecode(z: number): number {
  return z % 2 === 0 ? z / 2 : -(z + 1) / 2;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// LEB128 çözücü: build-district-boundaries.mjs'teki encodeVarintUnsigned ile
// bire bir eşleşmeli (7 bit veri + MSB devam biti).
function decodeVarints(bytes: Uint8Array): number[] {
  const values: number[] = [];
  let result = 0;
  let shift = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      values.push(result);
      result = 0;
      shift = 0;
    } else {
      shift += 7;
    }
  }
  return values;
}

function decodeRing(encoded: string): Array<[number, number]> {
  const zigzags = decodeVarints(base64ToBytes(encoded));
  const points: Array<[number, number]> = [];
  let lat = 0;
  let lon = 0;
  for (let i = 0; i < zigzags.length; i += 2) {
    lat += zigzagDecode(zigzags[i]);
    lon += zigzagDecode(zigzags[i + 1]);
    points.push([lat / 1e4, lon / 1e4]);
  }
  return points;
}

function parseBoundariesFile(file: DistrictBoundariesFile): EncodedDistrict[] {
  if (file.version !== EXPECTED_VERSION) {
    throw new Error(
      `districtBoundaries.json sürüm ${EXPECTED_VERSION} bekleniyor, ${file.version} bulundu — npm run build:districts çalıştırın`,
    );
  }
  return file.districts;
}

async function loadRawDistricts(): Promise<EncodedDistrict[]> {
  if (!rawDistrictsPromise) {
    rawDistrictsPromise = import('../data/districtBoundaries.json').then((mod) => {
      const file = (mod.default ?? mod) as unknown as DistrictBoundariesFile;
      return parseBoundariesFile(file);
    });
  }
  return rawDistrictsPromise;
}

function getDecodedRings(index: number, district: EncodedDistrict): Array<Array<[number, number]>> {
  let rings = decodedRingsCache.get(index);
  if (!rings) {
    rings = district.rings.map(decodeRing);
    decodedRingsCache.set(index, rings);
  }
  return rings;
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

function pointInDistrict(lat: number, lng: number, rings: Array<Array<[number, number]>>): boolean {
  let inside = false;
  for (const ring of rings) {
    if (pointInRing(lat, lng, ring)) inside = !inside;
  }
  return inside;
}

export async function resolveDistrict(lat: number, lng: number): Promise<ResolvedDistrict | null> {
  const districts = await loadRawDistricts();
  for (let i = 0; i < districts.length; i++) {
    const district = districts[i];
    if (!bboxContains(district.bbox, lat, lng)) continue;
    const rings = getDecodedRings(i, district);
    if (pointInDistrict(lat, lng, rings)) {
      return { il: district.il, ilce: district.ilce };
    }
  }
  return null;
}

export function __getDecodedDistrictCountForTest(): number {
  return decodedRingsCache.size;
}

export async function __getTotalDistrictCountForTest(): Promise<number> {
  const districts = await loadRawDistricts();
  return districts.length;
}

export function __decodeRingForTest(encoded: string): Array<[number, number]> {
  return decodeRing(encoded);
}

export function __parseBoundariesFileForTest(file: DistrictBoundariesFile): EncodedDistrict[] {
  return parseBoundariesFile(file);
}
