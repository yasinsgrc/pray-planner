import { isPrivacyConfigured } from './privacyFieldsConfigured';

/**
 * Deployer-specific identity fields for the Privacy Policy (design-refresh-v3
 * Faz 8) — the policy text itself is verified against this app's actual
 * data flows and ships as-is, but who the "veri sorumlusu" (data
 * controller) actually is, their address, contact email, and hosting
 * provider are facts only whoever deploys this app knows. (A log-retention
 * field used to live here too — dropped in Faz 24 Commit 2: the policy no
 * longer promises a specific retention period, since nothing in server/
 * enforces one.) None of these are secrets — VITE_ prefixed, embedded in
 * the browser build — but none have a safe default either, so an unset
 * field renders as a visible, hard-to-miss placeholder (PrivacyPolicyModal)
 * instead of silently shipping wrong or blank.
 */
export const PRIVACY_ENTITY_NAME = import.meta.env.VITE_PRIVACY_ENTITY_NAME as string | undefined;
export const PRIVACY_ADDRESS = import.meta.env.VITE_PRIVACY_ADDRESS as string | undefined;
export const PRIVACY_CONTACT_EMAIL = import.meta.env.VITE_PRIVACY_CONTACT_EMAIL as string | undefined;
export const PRIVACY_HOSTING_PROVIDER = import.meta.env.VITE_PRIVACY_HOSTING_PROVIDER as string | undefined;

export const PRIVACY_FIELDS_CONFIGURED = isPrivacyConfigured({
  entityName: PRIVACY_ENTITY_NAME,
  address: PRIVACY_ADDRESS,
  contactEmail: PRIVACY_CONTACT_EMAIL,
  hostingProvider: PRIVACY_HOSTING_PROVIDER,
});
