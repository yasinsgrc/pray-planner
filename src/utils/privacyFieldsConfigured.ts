/** The four deployer-specific identity fields the Privacy Policy needs to render without a
 * placeholder (design-refresh-v3 Faz 8, log-retention field dropped in Faz 24 Commit 2). Kept as a
 * pure function, separate from privacyConfig.ts's own `import.meta.env` reads, so it's importable
 * from node:test — same pattern as urlJoin.ts/apiBaseUrl.ts (see apiBaseUrl.test.ts's comment). */
export interface PrivacyFields {
  entityName: string | undefined;
  address: string | undefined;
  contactEmail: string | undefined;
  hostingProvider: string | undefined;
}

export function isPrivacyConfigured(fields: PrivacyFields): boolean {
  return Boolean(fields.entityName && fields.address && fields.contactEmail && fields.hostingProvider);
}
