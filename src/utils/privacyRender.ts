/**
 * Pure text-processing helpers for PRIVACY_SECTIONS' {{TOKEN}} substitution and
 * paragraph/list parsing — shared between PrivacyPolicyModal.tsx (renders to React
 * nodes, in-app) and scripts/generate-privacy-page.mjs (renders to a static HTML
 * string, public/gizlilik.html) so the parsing rules exist in exactly one place
 * instead of being reimplemented per consumer.
 */

export const PRIVACY_PLACEHOLDER_LABELS: Record<string, string> = {
  ENTITY_NAME: 'AD SOYAD veya ŞİRKET UNVANI',
  ADDRESS: 'ADRES',
  CONTACT_EMAIL: 'İLETİŞİM E-POSTASI',
  HOSTING_PROVIDER: 'HOSTING SAĞLAYICI',
  APP_URL: 'UYGULAMA URL',
};

/** Same disclaimer shown at the bottom of the in-app modal — kept here so the
 * public page can reuse the exact sentence instead of a second hand-typed copy. */
export const PRIVACY_DISCLAIMER =
  'Bu metin, uygulamanın kaynak kodunda fiilen doğrulanan veri akışlarına göre hazırlanmıştır. Hukuki danışmanlık değildir.';

export interface PrivacyTextPart {
  kind: 'text' | 'token';
  /** Literal text for kind 'text'; the resolved value (or '' if unresolved) for kind 'token'. */
  text: string;
  token?: string;
  resolved: boolean;
}

const TOKEN_PATTERN = /\{\{(\w+)\}\}/g;

/** Splits `text` around every {{TOKEN}} occurrence, resolving each against `values`. */
export function splitPrivacyText(text: string, values: Record<string, string | undefined>): PrivacyTextPart[] {
  const parts: PrivacyTextPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(TOKEN_PATTERN.source, 'g');

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: 'text', text: text.slice(lastIndex, match.index), resolved: true });
    }
    const token = match[1];
    const value = values[token];
    const resolved = Boolean(value && value.trim());
    parts.push({ kind: 'token', text: resolved ? (value as string) : '', token, resolved });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ kind: 'text', text: text.slice(lastIndex), resolved: true });
  }
  return parts;
}

export interface PrivacyParagraph {
  kind: 'list' | 'text';
  /** Populated only when kind === 'list' — each entry has its leading "- " stripped. */
  listItems: string[];
  /** Populated only when kind === 'text' — may still contain internal '\n'. */
  text: string;
}

/** \n\n separates paragraphs; a paragraph whose every non-empty line starts with "- " becomes a list. */
export function parsePrivacyBody(body: string): PrivacyParagraph[] {
  return body.split('\n\n').map((para) => {
    const lines = para.split('\n').filter((l) => l.length > 0);
    const isList = lines.length > 0 && lines.every((l) => l.startsWith('- '));
    if (isList) {
      return { kind: 'list' as const, listItems: lines.map((l) => l.slice(2)), text: '' };
    }
    return { kind: 'text' as const, listItems: [], text: para };
  });
}
