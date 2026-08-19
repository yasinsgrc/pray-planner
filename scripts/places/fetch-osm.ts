import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, ".cache");
const OUTPUT_PATH = path.join(CACHE_DIR, "osm-raw.json");
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const TIMEOUT_MS = 300_000;

const QUERY = `
[out:json][timeout:300];
area["ISO3166-1"="TR"][admin_level=2]->.tr;
(
  nwr["amenity"="place_of_worship"]["religion"="muslim"](area.tr);
  nwr["historic"="tomb"](area.tr);
  nwr["building"="mausoleum"](area.tr);
);
out center tags;
`;

async function main() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(QUERY)}`,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Overpass API isteği başarısız: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(data, null, 2), "utf-8");

  console.log(`Yazıldı: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
