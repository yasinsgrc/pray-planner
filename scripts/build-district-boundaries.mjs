import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, ".cache");
const OUTPUT_PATH = path.join(__dirname, "..", "src", "data", "districtBoundaries.json");
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const TIMEOUT_MS = 300_000;
const REQUEST_DELAY_MS = 2_000;
const SIMPLIFY_TOLERANCE_METERS = 30;
const MIN_DISTRICT_COUNT = 900;
const MAX_DISTRICT_COUNT = 1_000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOverpass(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "*/*",
        "User-Agent": "curl/8.0.0",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Overpass API isteği başarısız: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.remark) {
    throw new Error(`Overpass API remark döndürdü: ${data.remark}`);
  }
  if (!Array.isArray(data.elements)) {
    throw new Error("Overpass API yanıtında elements dizisi yok");
  }

  return data;
}

async function cachedFetch(cacheFile, query) {
  try {
    const cached = await readFile(cacheFile, "utf-8");
    return { data: JSON.parse(cached), fetched: false };
  } catch {
    // önbellek yok, ağdan çek
  }

  const data = await fetchOverpass(query);
  await writeFile(cacheFile, JSON.stringify(data), "utf-8");
  return { data, fetched: true };
}

async function getProvinces() {
  const cacheFile = path.join(CACHE_DIR, "provinces.json");
  const query = `
[out:json][timeout:120];
area["ISO3166-1"="TR"][admin_level=2]->.tr;
relation["boundary"="administrative"]["admin_level"="4"](area.tr);
out tags;
`;
  const { data } = await cachedFetch(cacheFile, query);
  const provinces = data.elements
    .filter((element) => element.type === "relation" && element.tags?.name)
    .map((element) => ({ id: element.id, name: element.tags.name }));

  if (provinces.length === 0) {
    throw new Error("İl listesi boş döndü");
  }
  return provinces;
}

async function getDistrictsForProvince(province) {
  const cacheFile = path.join(CACHE_DIR, `district-${province.id}.json`);
  const areaId = 3_600_000_000 + province.id;
  const query = `
[out:json][timeout:180];
relation["boundary"="administrative"]["admin_level"="6"](area:${areaId});
out geom;
`;
  return cachedFetch(cacheFile, query);
}

function pointsEqual(a, b) {
  return a.lat === b.lat && a.lon === b.lon;
}

// İdari sınır relation'ları çoğunlukla birden fazla way segmentine bölünür;
// bunları ortak uç noktalarından zincirleyip kapalı ring'lere birleştiriyoruz.
function assembleClosedRings(segments) {
  const remaining = segments.map((segment) => segment.slice());
  const rings = [];

  while (remaining.length > 0) {
    let current = remaining.shift();
    let closed = pointsEqual(current[0], current[current.length - 1]);
    let progress = true;

    while (!closed && progress) {
      progress = false;
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const segStart = seg[0];
        const segEnd = seg[seg.length - 1];
        const curEnd = current[current.length - 1];
        const curStart = current[0];

        if (pointsEqual(segStart, curEnd)) {
          current = current.concat(seg.slice(1));
        } else if (pointsEqual(segEnd, curEnd)) {
          current = current.concat(seg.slice(0, -1).reverse());
        } else if (pointsEqual(segEnd, curStart)) {
          current = seg.slice(0, -1).concat(current);
        } else if (pointsEqual(segStart, curStart)) {
          current = seg.slice(1).reverse().concat(current);
        } else {
          continue;
        }

        remaining.splice(i, 1);
        progress = true;
        break;
      }
      closed = pointsEqual(current[0], current[current.length - 1]);
    }

    if (!closed) {
      return null;
    }
    rings.push(current);
  }

  return rings;
}

function buildRings(element) {
  const outerSegments = [];
  const innerSegments = [];

  for (const member of element.members ?? []) {
    if (member.type !== "way" || !member.geometry) continue;
    if (member.role === "outer") outerSegments.push(member.geometry);
    else if (member.role === "inner") innerSegments.push(member.geometry);
  }

  if (outerSegments.length === 0) return null;

  const outer = assembleClosedRings(outerSegments);
  if (!outer) return null;

  const inner = innerSegments.length > 0 ? assembleClosedRings(innerSegments) : [];
  if (innerSegments.length > 0 && !inner) return null;

  return { outer, inner };
}

function perpendicularDistance(p, p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - p1.x, p.y - p1.y);

  const t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / (dx * dx + dy * dy);
  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

function simplifySection(points, start, end, epsilon, keep) {
  if (end <= start + 1) return;

  let maxDist = -1;
  let maxIndex = -1;
  for (let i = start + 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[start], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > epsilon) {
    keep[maxIndex] = true;
    simplifySection(points, start, maxIndex, epsilon, keep);
    simplifySection(points, maxIndex, end, epsilon, keep);
  }
}

function simplifyRing(points, toleranceMeters) {
  if (points.length <= 4) return points;

  const refLat = (points[0].lat * Math.PI) / 180;
  const metersPerDegreeLon = Math.cos(refLat) * 111_320;
  const projected = points.map((p) => ({ x: p.lon * metersPerDegreeLon, y: p.lat * 111_320 }));

  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  simplifySection(projected, 0, points.length - 1, toleranceMeters, keep);

  return points.filter((_, i) => keep[i]);
}

function round5(value) {
  return Math.round(value * 1e5) / 1e5;
}

function encodeRing(points) {
  const flat = [];
  let prevLat = 0;
  let prevLon = 0;

  points.forEach((p, i) => {
    const lat = Math.round(p.lat * 1e5);
    const lon = Math.round(p.lon * 1e5);
    if (i === 0) {
      flat.push(lat, lon);
    } else {
      flat.push(lat - prevLat, lon - prevLon);
    }
    prevLat = lat;
    prevLon = lon;
  });

  return flat;
}

function computeBbox(points) {
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLng) minLng = p.lon;
    if (p.lon > maxLng) maxLng = p.lon;
  }

  return [round5(minLat), round5(minLng), round5(maxLat), round5(maxLng)];
}

function validate(districts, fileSize) {
  const errors = [];

  if (districts.length < MIN_DISTRICT_COUNT || districts.length > MAX_DISTRICT_COUNT) {
    errors.push(
      `İlçe sayısı beklenen aralıkta değil (${MIN_DISTRICT_COUNT}-${MAX_DISTRICT_COUNT}): ${districts.length}`,
    );
  }

  if (fileSize > MAX_OUTPUT_BYTES) {
    errors.push(`Dosya boyutu 2 MB sınırını aşıyor: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  }

  const hasDarica = districts.some((d) => d.il === "Kocaeli" && d.ilce === "Darıca");
  const hasCayirova = districts.some((d) => d.il === "Kocaeli" && d.ilce === "Çayırova");
  if (!hasDarica) errors.push("Kocaeli/Darıca kaydı bulunamadı");
  if (!hasCayirova) errors.push("Kocaeli/Çayırova kaydı bulunamadı");

  for (const d of districts) {
    for (const ring of d.rings) {
      if (ring.length < 8) {
        errors.push(`${d.il}/${d.ilce}: bir ring 4 noktadan az (${ring.length / 2} nokta)`);
      }
    }
  }

  return errors;
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });

  const provinces = await getProvinces();
  console.log(`İl sayısı: ${provinces.length}`);

  const districts = [];
  let totalVertices = 0;

  for (let i = 0; i < provinces.length; i++) {
    const province = provinces[i];
    const { data, fetched } = await getDistrictsForProvince(province);

    for (const element of data.elements) {
      if (element.type !== "relation" || !element.tags?.name) continue;

      const rings = buildRings(element);
      if (!rings) {
        console.error(`Birleştirilemeyen relation: ${element.tags.name} (id=${element.id}, il=${province.name})`);
        continue;
      }

      const encodedRings = [];
      const allPoints = [];
      for (const ring of [...rings.outer, ...rings.inner]) {
        const simplified = simplifyRing(ring, SIMPLIFY_TOLERANCE_METERS);
        allPoints.push(...simplified);
        encodedRings.push(encodeRing(simplified));
        totalVertices += simplified.length;
      }

      districts.push({
        il: province.name,
        ilce: element.tags.name,
        bbox: computeBbox(allPoints),
        rings: encodedRings,
      });
    }

    if (fetched && i < provinces.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  const output = { version: 1, attribution: "© OpenStreetMap contributors (ODbL)", districts };
  await writeFile(OUTPUT_PATH, JSON.stringify(output), "utf-8");

  const stats = await stat(OUTPUT_PATH);
  console.log(`İlçe sayısı: ${districts.length}`);
  console.log(`Toplam vertex: ${totalVertices}`);
  console.log(`Dosya boyutu: ${(stats.size / 1024).toFixed(1)} KB`);

  const errors = validate(districts, stats.size);
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
