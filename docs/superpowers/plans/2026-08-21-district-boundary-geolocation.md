# District Boundary Geolocation (Faz 28) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "nearest centroid" district guess with an exact point-in-polygon match against real Turkey ilçe (district) boundaries, falling back to the existing centroid heuristic only when no polygon contains the point.

**Architecture:** A one-off Node script downloads Turkey's ADM1 (il) and ADM2 (ilçe) boundaries from geoBoundaries.org, simplifies them (Douglas-Peucker, ~0.001° tolerance), assigns each ilçe to its containing il, and writes the result as a checked-in TS data file (`src/data/districtBoundaries.ts`) — same pattern as the existing `licenses.generated.ts`. At runtime, `findDistrictByPoint(lat, lng)` does a bbox pre-filter over the ~973 districts, then an even-odd ray-casting test (with hole support) on any bbox-surviving candidates. It sits in *front of* `findNearestLocation`, never replacing it: `findDistrictByPoint(lat, lng) ?? findNearestLocation(lat, lng)`.

**Tech Stack:** TypeScript, Node `--test` runner (via `tsx`), no new runtime dependencies (Douglas-Peucker and ray-casting are hand-rolled — both are simple enough that a well-tested npm dependency isn't worth the addition, per this project's existing lean-dependency convention).

**Data source & license (already resolved with the user, do not re-litigate):** geoBoundaries.org TUR ADM1 + ADM2, pinned to release commit `9469f09` (resolved 2026-08-21). Treated as CC BY 4.0 per geoBoundaries' site-wide license claim, attribution added per Task 8. The underlying per-boundary metadata says the ADM2 source is OSM-derived and ODbL at origin — the user explicitly chose to proceed under geoBoundaries' CC BY 4.0 wrapper with attribution rather than treat it as ODbL share-alike.

---

## File Structure

- `src/lib/geo/pointInPolygon.ts` — pure ray-casting algorithm, ring + hole + multipolygon support. No data, no I/O.
- `src/lib/geo/findDistrictByPoint.ts` — bbox pre-filter + `pointInPolygon` over `DISTRICT_BOUNDARIES`. The one production entry point.
- `src/data/districtBoundaries.ts` — **generated**, checked in. ~973 district polygons.
- `src/data/districtBoundaryAttribution.ts` — CC BY 4.0 attribution fields, same shape as the existing `ezanAttribution.ts`.
- `scripts/geo/ringGeometry.ts` — `ringSignedArea` / `ringCentroidApprox`, used only by the generator.
- `scripts/geo/simplifyRing.ts` — Douglas-Peucker simplifier, used only by the generator.
- `scripts/geo/buildDistrictBoundaries.ts` — the one-off generator (fetch → simplify → assign province → write).
- `src/App.tsx` — one call site swapped (location-drift check).
- `src/components/LocationModal.tsx` — one call site swapped (GPS button).
- `src/components/LicensesModal.tsx` — one new attribution section.

---

### Task 1: `pointInPolygon` core algorithm

**Files:**
- Create: `src/lib/geo/pointInPolygon.ts`
- Test: `src/lib/geo/pointInPolygon.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/geo/pointInPolygon.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointInPolygon, pointInMultiPolygon } from './pointInPolygon';

const UNIT_SQUARE = [
  [0, 0], [0, 10], [10, 10], [10, 0], [0, 0],
] as const;

const UNIT_SQUARE_WITH_HOLE = [
  UNIT_SQUARE,
  [[4, 4], [4, 6], [6, 6], [6, 4], [4, 4]], // hole in the middle
] as const;

test('pointInPolygon: point inside a plain square is true', () => {
  assert.equal(pointInPolygon(5, 5, [UNIT_SQUARE]), true);
});

test('pointInPolygon: point outside a plain square is false', () => {
  assert.equal(pointInPolygon(15, 15, [UNIT_SQUARE]), false);
});

test('pointInPolygon: point inside the hole is false', () => {
  assert.equal(pointInPolygon(5, 5, UNIT_SQUARE_WITH_HOLE), false);
});

test('pointInPolygon: point inside the ring but outside the hole is true', () => {
  assert.equal(pointInPolygon(1, 1, UNIT_SQUARE_WITH_HOLE), true);
});

test('pointInMultiPolygon: point matches the second disjoint polygon', () => {
  const farSquare = [[20, 20], [20, 30], [30, 30], [30, 20], [20, 20]] as const;
  assert.equal(pointInMultiPolygon(25, 25, [[UNIT_SQUARE], [farSquare]]), true);
});

test('pointInMultiPolygon: point matching neither polygon is false', () => {
  const farSquare = [[20, 20], [20, 30], [30, 30], [30, 20], [20, 20]] as const;
  assert.equal(pointInMultiPolygon(100, 100, [[UNIT_SQUARE], [farSquare]]), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/lib/geo/pointInPolygon.test.ts`
Expected: FAIL — `Cannot find module './pointInPolygon'`

- [ ] **Step 3: Implement**

```typescript
// src/lib/geo/pointInPolygon.ts
export type Point = readonly [lng: number, lat: number];
export type Ring = readonly Point[];
/** GeoJSON Polygon convention: rings[0] is the exterior ring, rings[1..] are holes. */
export type PolygonRings = readonly Ring[];

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > lat !== yj > lat;
    if (crosses && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInPolygon(lng: number, lat: number, rings: PolygonRings): boolean {
  if (rings.length === 0 || !pointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false;
  }
  return true;
}

export function pointInMultiPolygon(lng: number, lat: number, polygons: readonly PolygonRings[]): boolean {
  return polygons.some((rings) => pointInPolygon(lng, lat, rings));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test src/lib/geo/pointInPolygon.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo/pointInPolygon.ts src/lib/geo/pointInPolygon.test.ts
git commit -m "feat(geo): add ray-casting pointInPolygon with hole support"
```

---

### Task 2: Ring geometry helpers (area + centroid)

**Files:**
- Create: `scripts/geo/ringGeometry.ts`
- Test: `scripts/geo/ringGeometry.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// scripts/geo/ringGeometry.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringSignedArea, ringCentroidApprox } from './ringGeometry';

const UNIT_SQUARE = [
  [0, 0], [0, 10], [10, 10], [10, 0], [0, 0],
] as const;

test('ringSignedArea: 10x10 square has |area| 100', () => {
  assert.equal(Math.abs(ringSignedArea(UNIT_SQUARE)), 100);
});

test('ringCentroidApprox: square centered on origin returns its center', () => {
  const [cx, cy] = ringCentroidApprox(UNIT_SQUARE);
  assert.equal(cx, 5);
  assert.equal(cy, 5);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --import tsx --test scripts/geo/ringGeometry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// scripts/geo/ringGeometry.ts
type Point = readonly [number, number];

/** Shoelace formula. Sign indicates winding order — callers that only need
 * magnitude (e.g. "which ring is biggest") should take Math.abs(). */
export function ringSignedArea(ring: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** Arithmetic mean of the ring's vertices (last point is the closing
 * duplicate of the first, so it's excluded). Not the true polygon centroid
 * for concave shapes — callers needing a guaranteed-interior point must
 * verify with pointInPolygon and fall back to a vertex if it lands outside. */
export function ringCentroidApprox(ring: readonly Point[]): Point {
  let sumX = 0;
  let sumY = 0;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    sumX += ring[i][0];
    sumY += ring[i][1];
  }
  return [sumX / n, sumY / n];
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --import tsx --test scripts/geo/ringGeometry.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/geo/ringGeometry.ts scripts/geo/ringGeometry.test.ts
git commit -m "feat(geo): add ring area/centroid helpers for the boundary generator"
```

---

### Task 3: Ring simplifier (Douglas-Peucker)

**Files:**
- Create: `scripts/geo/simplifyRing.ts`
- Test: `scripts/geo/simplifyRing.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// scripts/geo/simplifyRing.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simplifyRing } from './simplifyRing';

test('simplifyRing: collinear points collapse to just the endpoints', () => {
  const line = [[0, 0], [1, 0], [2, 0], [3, 0]] as const;
  const result = simplifyRing(line, 0.001);
  assert.deepEqual(result, [[0, 0], [3, 0]]);
});

test('simplifyRing: a point that deviates beyond epsilon is kept', () => {
  const spike = [[0, 0], [1, 1], [2, 0]] as const; // midpoint 1 unit off the 0,0->2,0 line
  const result = simplifyRing(spike, 0.5);
  assert.deepEqual(result, [[0, 0], [1, 1], [2, 0]]);
});

test('simplifyRing: a point that deviates less than epsilon is dropped', () => {
  const nearlyStraight = [[0, 0], [1, 0.0001], [2, 0]] as const;
  const result = simplifyRing(nearlyStraight, 0.001);
  assert.deepEqual(result, [[0, 0], [2, 0]]);
});

test('simplifyRing: a closed square keeps all 4 corners at a tight tolerance', () => {
  const square = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]] as const;
  const result = simplifyRing(square, 0.001);
  assert.equal(result.length, 5);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --import tsx --test scripts/geo/simplifyRing.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// scripts/geo/simplifyRing.ts
type Point = readonly [number, number];

function perpendicularDistance(point: Point, a: Point, b: Point): number {
  const [x, y] = point;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  const projX = x1 + clampedT * dx;
  const projY = y1 + clampedT * dy;
  return Math.hypot(x - projX, y - projY);
}

/** Ramer-Douglas-Peucker line simplification. Works on any polyline,
 * including closed rings (first === last point) — callers that need the
 * ring to stay closed should pass epsilon small enough that the first/last
 * point is always kept, or just re-check length >= 4 (this project's
 * generator does the latter, see buildDistrictBoundaries.ts). */
export function simplifyRing(points: readonly Point[], epsilon: number): Point[] {
  if (points.length <= 2) return [...points];

  let maxDist = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyRing(points.slice(0, index + 1), epsilon);
    const right = simplifyRing(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [start, end];
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --import tsx --test scripts/geo/simplifyRing.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/geo/simplifyRing.ts scripts/geo/simplifyRing.test.ts
git commit -m "feat(geo): add Douglas-Peucker ring simplifier for the boundary generator"
```

---

### Task 4: District boundary data generator (run once, output checked in)

**Files:**
- Create: `scripts/geo/buildDistrictBoundaries.ts`
- Create (generated by running the script, then checked in): `src/data/districtBoundaries.ts`

- [ ] **Step 1: Write the generator**

```typescript
// scripts/geo/buildDistrictBoundaries.ts
// One-off data generator. Run manually with:
//   npx tsx scripts/geo/buildDistrictBoundaries.ts
// Only re-run this if the upstream geoBoundaries release changes — it's not
// part of the build or CI.
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { simplifyRing } from './simplifyRing';
import { ringSignedArea, ringCentroidApprox } from './ringGeometry';
import { pointInPolygon, pointInMultiPolygon } from '../../src/lib/geo/pointInPolygon';
import type { PolygonRings } from '../../src/lib/geo/pointInPolygon';
import { haversineDistanceKm } from '../../src/utils/geo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..', '..');

// Pinned to a specific geoBoundaries release commit (resolved 2026-08-21 via
// https://www.geoboundaries.org/api/current/gbOpen/TUR/ADM{1,2}/) so this
// script is reproducible — re-running it later won't silently pick up a
// different upstream revision. Data: geoBoundaries.org, CC BY 4.0 (see
// src/data/districtBoundaryAttribution.ts for the in-app credit).
const ADM1_URL =
  'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUR/ADM1/geoBoundaries-TUR-ADM1_simplified.geojson';
const ADM2_URL =
  'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUR/ADM2/geoBoundaries-TUR-ADM2_simplified.geojson';

const SIMPLIFY_EPSILON_DEG = 0.001;

type Point = readonly [number, number];

interface GeoJsonFeature {
  properties: { shapeName: string };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
}

function extractPolygons(geometry: GeoJsonFeature['geometry']): PolygonRings[] {
  const raw =
    geometry.type === 'Polygon'
      ? [geometry.coordinates as number[][][]]
      : (geometry.coordinates as number[][][][]);
  return raw.map((rings) => rings.map((ring) => ring.map(([lng, lat]) => [lng, lat] as Point)));
}

function simplifyPolygons(polygons: PolygonRings[]): PolygonRings[] {
  return polygons.map((rings) =>
    rings.map((ring) => {
      const simplified = simplifyRing(ring, SIMPLIFY_EPSILON_DEG);
      return simplified.length >= 4 ? simplified : ring;
    })
  );
}

function computeBbox(polygons: PolygonRings[]): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const rings of polygons) {
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

/** A point guaranteed (or very likely) to sit inside the district's own
 * polygon — the largest exterior ring's approximate centroid, corrected to
 * one of its own vertices if the naive centroid falls outside a concave
 * shape. Only used to decide which province the district belongs to, so
 * near-boundary approximation is acceptable — the app never displays this
 * point, it displays the raw GPS coordinate (see App.tsx / LocationModal.tsx). */
function representativePoint(polygons: PolygonRings[]): Point {
  let best: { ring: Point[]; area: number } | null = null;
  for (const rings of polygons) {
    const exterior = rings[0] as Point[];
    const area = Math.abs(ringSignedArea(exterior));
    if (!best || area > best.area) best = { ring: exterior, area };
  }
  const ring = best!.ring;
  const centroid = ringCentroidApprox(ring);
  if (pointInPolygon(centroid[0], centroid[1], [ring])) return centroid;
  return ring[0];
}

async function fetchGeoJson(url: string): Promise<{ features: GeoJsonFeature[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

async function main() {
  console.log('Fetching ADM1 (il) boundaries...');
  const adm1 = await fetchGeoJson(ADM1_URL);
  console.log('Fetching ADM2 (ilçe) boundaries...');
  const adm2 = await fetchGeoJson(ADM2_URL);

  const provinces = adm1.features.map((f) => ({
    name: f.properties.shapeName,
    polygons: simplifyPolygons(extractPolygons(f.geometry)),
  }));

  function findProvince(point: Point): string {
    for (const p of provinces) {
      if (pointInMultiPolygon(point[0], point[1], p.polygons)) return p.name;
    }
    // Border seam introduced by simplification — fall back to nearest
    // province by centroid distance rather than failing the whole build.
    let closest = provinces[0];
    let minDist = Infinity;
    for (const p of provinces) {
      const c = ringCentroidApprox(p.polygons[0][0] as Point[]);
      const dist = haversineDistanceKm(point[1], point[0], c[1], c[0]);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    }
    console.warn(`  ! no exact province match for [${point}], using nearest: ${closest.name}`);
    return closest.name;
  }

  const districts = adm2.features.map((f) => {
    const simplified = simplifyPolygons(extractPolygons(f.geometry));
    const point = representativePoint(simplified);
    return {
      il: findProvince(point),
      ilce: f.properties.shapeName,
      bbox: computeBbox(simplified),
      polygons: simplified,
    };
  });

  const output = `// AUTO-GENERATED by scripts/geo/buildDistrictBoundaries.ts — do not edit by hand.
// Regenerate with: npx tsx scripts/geo/buildDistrictBoundaries.ts
// Source: geoBoundaries.org TUR ADM1/ADM2 (CC BY 4.0), derived from
// OpenStreetMap contributors — see src/data/districtBoundaryAttribution.ts
// for the in-app credit (design-refresh-v3 Faz 28).

import type { PolygonRings } from '../lib/geo/pointInPolygon';

export interface DistrictBoundary {
  il: string;
  ilce: string;
  bbox: readonly [number, number, number, number];
  polygons: readonly PolygonRings[];
}

export const DISTRICT_BOUNDARIES: readonly DistrictBoundary[] = ${JSON.stringify(districts)};
`;

  const outPath = path.join(PROJECT_ROOT, 'src', 'data', 'districtBoundaries.ts');
  writeFileSync(outPath, output, 'utf8');
  console.log(`Wrote ${districts.length} districts to ${path.relative(PROJECT_ROOT, outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Run it**

Run: `npx tsx scripts/geo/buildDistrictBoundaries.ts`
Expected: `Fetching ADM1...` / `Fetching ADM2...`, zero or a small number of `! no exact province match` warnings (review any that appear — should be none or a handful of tiny-island edge cases), then `Wrote 973 districts to src/data/districtBoundaries.ts`.

- [ ] **Step 3: Sanity-check the output**

Run: `grep -c '"ilce":"Üsküdar"' src/data/districtBoundaries.ts`
Expected: `1`

Run: `grep -c '"ilce":"Darıca"' src/data/districtBoundaries.ts`
Expected: `1`

- [ ] **Step 4: Commit**

```bash
git add scripts/geo/buildDistrictBoundaries.ts src/data/districtBoundaries.ts
git commit -m "feat(geo): generate Turkey ilçe boundary dataset from geoBoundaries"
```

---

### Task 5: `findDistrictByPoint`

**Files:**
- Create: `src/lib/geo/findDistrictByPoint.ts`
- Test: `src/lib/geo/findDistrictByPoint.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/geo/findDistrictByPoint.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDistrictByPoint } from './findDistrictByPoint';

test('findDistrictByPoint: a coordinate inside Üsküdar resolves to İstanbul/Üsküdar', () => {
  const result = findDistrictByPoint(41.03, 29.02);
  assert.equal(result?.cityName, 'İstanbul');
  assert.equal(result?.districtName, 'Üsküdar');
  assert.equal(result?.country, 'Türkiye');
  assert.equal(result?.timeZone, 'Europe/Istanbul');
});

test('findDistrictByPoint: Darıca resolves to Darıca, not the adjacent Çayırova (Faz 14 regression)', () => {
  const result = findDistrictByPoint(40.76, 29.38);
  assert.equal(result?.districtName, 'Darıca');
});

test('findDistrictByPoint: a coordinate far outside Turkey returns null', () => {
  const result = findDistrictByPoint(21.42, 39.83); // Mecca
  assert.equal(result, null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --import tsx --test src/lib/geo/findDistrictByPoint.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// src/lib/geo/findDistrictByPoint.ts
import { DISTRICT_BOUNDARIES } from '../../data/districtBoundaries';
import { pointInMultiPolygon } from './pointInPolygon';

export interface DistrictMatch {
  cityName: string;
  districtName: string;
  country: string;
  timeZone: string;
}

/**
 * Polygon-accurate alternative to findNearestLocation's centroid guess
 * (design-refresh-v3 Faz 28) — bbox pre-filter, then exact ray-casting
 * against the real ilçe boundary. Returns null when no polygon contains the
 * point (outside Turkey, or a border simplification seam); callers must
 * fall back to findNearestLocation in that case, never assume a match.
 */
export function findDistrictByPoint(lat: number, lng: number): DistrictMatch | null {
  for (const district of DISTRICT_BOUNDARIES) {
    const [minLng, minLat, maxLng, maxLat] = district.bbox;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
    if (pointInMultiPolygon(lng, lat, district.polygons)) {
      return {
        cityName: district.il,
        districtName: district.ilce,
        country: 'Türkiye',
        timeZone: 'Europe/Istanbul',
      };
    }
  }
  return null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --import tsx --test src/lib/geo/findDistrictByPoint.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo/findDistrictByPoint.ts src/lib/geo/findDistrictByPoint.test.ts
git commit -m "feat(geo): add findDistrictByPoint, polygon-accurate district lookup"
```

---

### Task 6: Wire into `App.tsx`'s location-drift check

**Files:**
- Modify: `src/App.tsx:48` (import), `src/App.tsx:342` (call site)

- [ ] **Step 1: Add the import**

In `src/App.tsx`, next to the existing `findNearestLocation` import (line 48):

```typescript
import { findNearestLocation } from './utils/geo';
import { findDistrictByPoint } from './lib/geo/findDistrictByPoint';
```

- [ ] **Step 2: Swap the call site**

At `src/App.tsx:342`, replace:

```typescript
          const nearest = findNearestLocation(latitude, longitude);
```

with:

```typescript
          const nearest = findDistrictByPoint(latitude, longitude) ?? findNearestLocation(latitude, longitude);
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no new errors (both `findDistrictByPoint`'s `DistrictMatch` and `findNearestLocation`'s `LocationItem` provide `cityName`/`districtName`/`country`/`timeZone`, which is all the surrounding code at lines 344–356 reads before overriding `id`/`lat`/`lng`).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(geo): use polygon-accurate district match in the location-drift check"
```

---

### Task 7: Wire into `LocationModal.tsx`'s GPS button

**Files:**
- Modify: `src/components/LocationModal.tsx:5` (import), `src/components/LocationModal.tsx:157` (call site)

- [ ] **Step 1: Add the import**

Next to the existing import at line 5:

```typescript
import { findNearestLocation } from '../utils/geo';
import { findDistrictByPoint } from '../lib/geo/findDistrictByPoint';
```

- [ ] **Step 2: Swap the call site**

At `src/components/LocationModal.tsx:157`, replace:

```typescript
        const nearest = findNearestLocation(latitude, longitude);
```

with:

```typescript
        const nearest = findDistrictByPoint(latitude, longitude) ?? findNearestLocation(latitude, longitude);
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/LocationModal.tsx
git commit -m "feat(geo): use polygon-accurate district match for the GPS button"
```

---

### Task 8: CC BY 4.0 attribution

**Files:**
- Create: `src/data/districtBoundaryAttribution.ts`
- Modify: `src/components/LicensesModal.tsx`

- [ ] **Step 1: Add the attribution data**

```typescript
// src/data/districtBoundaryAttribution.ts
export interface DistrictBoundaryAttribution {
  workTitle: string;
  source: string;
  sourceUrl: string;
  licenseUrl: string;
  modificationStatement: string;
}

/**
 * CC BY 4.0 attribution for the ilçe boundary dataset used by
 * findDistrictByPoint (design-refresh-v3 Faz 28). Same 4-field pattern as
 * ezanAttribution.ts's CC BY-SA 4.0 credit, minus "uploader" (geoBoundaries
 * publishes as an organization, not an individual).
 */
export const DISTRICT_BOUNDARY_ATTRIBUTION: DistrictBoundaryAttribution = {
  workTitle: 'Turkey — Subnational Administrative Boundaries (ADM1, ADM2)',
  source: 'geoBoundaries.org, derived from OpenStreetMap contributors',
  sourceUrl: 'https://www.geoboundaries.org/countryDownloads.html?country=TUR',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  modificationStatement:
    'Değiştirildi — sınır çizgileri Douglas-Peucker algoritmasıyla ~0.001° toleransla sadeleştirildi ve her ilçe için il ataması yerel olarak hesaplandı (scripts/geo/buildDistrictBoundaries.ts).',
};
```

- [ ] **Step 2: Render it in the Licenses screen**

In `src/components/LicensesModal.tsx`, add the import next to `EZAN_ATTRIBUTION`:

```typescript
import { EZAN_ATTRIBUTION } from '../data/ezanAttribution';
import { DISTRICT_BOUNDARY_ATTRIBUTION } from '../data/districtBoundaryAttribution';
```

Add a new `<section>` immediately after the existing Ezan `<section>` (before the "Açık Kaynak Kütüphaneler" section):

```tsx
        <section>
          <h3 className="text-sm font-bold text-gold-ink mb-2">İlçe Sınırları — CC BY 4.0 Atfı</h3>
          <div className="p-3 rounded-xl bg-card border border-hairline space-y-1.5 text-[11px]">
            <div>
              <span className="text-mist">Eser: </span>
              <span className="text-ink font-medium">{DISTRICT_BOUNDARY_ATTRIBUTION.workTitle}</span>
            </div>
            <div>
              <span className="text-mist">Kaynak: </span>
              <span className="text-ink font-medium">{DISTRICT_BOUNDARY_ATTRIBUTION.source}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-mist shrink-0">Bağlantı:</span>
              <a
                href={DISTRICT_BOUNDARY_ATTRIBUTION.sourceUrl}
                className="text-gold-ink break-all inline-flex items-center min-h-[44px]"
              >
                {DISTRICT_BOUNDARY_ATTRIBUTION.sourceUrl}
              </a>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-mist shrink-0">Lisans:</span>
              <a
                href={DISTRICT_BOUNDARY_ATTRIBUTION.licenseUrl}
                className="text-gold-ink break-all inline-flex items-center min-h-[44px]"
              >
                {DISTRICT_BOUNDARY_ATTRIBUTION.licenseUrl}
              </a>
            </div>
            <div>
              <span className="text-mist">Değişiklik: </span>
              <span className="text-ink">{DISTRICT_BOUNDARY_ATTRIBUTION.modificationStatement}</span>
            </div>
          </div>
        </section>
```

- [ ] **Step 3: Verify types + visually check**

Run: `npx tsc --noEmit`
Expected: no new errors.

Open the app, go to the screen that opens `LicensesModal` (Settings/Ayarlar → Lisanslar), confirm the new "İlçe Sınırları — CC BY 4.0 Atfı" section renders correctly above the open-source library list.

- [ ] **Step 4: Commit**

```bash
git add src/data/districtBoundaryAttribution.ts src/components/LicensesModal.tsx
git commit -m "feat(geo): add CC BY 4.0 attribution for the district boundary dataset"
```

---

### Task 9: Full verification gate + push

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (0 errors)

- [ ] **Step 2: Full test suite**

Run: `npm test 2>&1 | tail -15`
Expected: all suites (server, frontend, scripts) pass, including the new `pointInPolygon`, `ringGeometry`, `simplifyRing`, `findDistrictByPoint` tests.

- [ ] **Step 3: UTC timezone test run**

Run: `npm run test:tz-utc 2>&1 | tail -8`
Expected: clean — same tests re-run under `TZ=UTC` to catch any hidden local-timezone assumptions.

- [ ] **Step 4: Build**

Run: `npm run build 2>&1 | tail -5`
Expected: clean build; note the resulting bundle size delta for `districtBoundaries.ts` (~973 districts of simplified polygon data) — if it visibly inflates the main chunk, that's expected and acceptable per this plan's scope (no code-splitting was requested), but worth mentioning to the user in the final summary.

- [ ] **Step 5: Push**

```bash
git push
```

(Per the user's explicit instruction to implement and push this Faz 28 work.)
