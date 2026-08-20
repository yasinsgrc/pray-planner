export function buildGoogleMapsUrl(name: string, lat: number, lon: number): string {
  const query = encodeURIComponent(`${name} ${lat},${lon}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
