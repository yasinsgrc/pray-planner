const GRID_SIZE = 0.1;

function gridIndex(value: number): number {
  const scaled = Math.round((value / GRID_SIZE) * 1e6) / 1e6;
  return Math.floor(scaled);
}

export function bucketKey(lat: number, lon: number): string {
  return `${gridIndex(lat)}_${gridIndex(lon)}`;
}

export function neighborBuckets(lat: number, lon: number): string[] {
  const latIndex = gridIndex(lat);
  const lonIndex = gridIndex(lon);
  const neighbors: string[] = [];
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      neighbors.push(`${latIndex + di}_${lonIndex + dj}`);
    }
  }
  return neighbors;
}
