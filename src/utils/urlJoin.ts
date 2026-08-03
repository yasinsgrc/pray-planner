/** Pure path-joining logic, kept in its own file with zero
 * `import.meta.env` reference so it's importable under plain node:test —
 * apiBaseUrl.ts (which DOES read import.meta.env at module load) can't be
 * imported there at all, since the whole module body runs on import. */
export function joinApiUrl(base: string, path: string): string {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
