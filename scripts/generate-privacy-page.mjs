// public/gizlilik.html'i src/data/privacy.ts'ten üretir — Play Console/Data
// Safety gibi mağaza kayıtları uygulamayı KURMADAN erişilebilen bir gizlilik
// politikası URL'i zorunlu tutuyor, ama bu proje router içermiyor (netlify.toml
// her yolu index.html'e düşürüyor) ve metin şu ana kadar yalnızca uygulama içi
// PrivacyPolicyModal ile erişilebiliyordu. Metin burada elle ikinci kez
// yazılmaz — PRIVACY_SECTIONS/PRIVACY_LAST_UPDATED (src/data/privacy.ts) tek
// kaynak kalır; {{TOKEN}} ayrıştırma ve paragraf/liste parse mantığı
// PrivacyPolicyModal.tsx ile src/utils/privacyRender.ts üzerinden paylaşılır.
//
// Run with: npm run generate:privacy (VITE_PRIVACY_* .env değişkenleri
// tanımlı olmalı — bkz. .env.example; eksikse betik hata fırlatıp çıkar,
// {{ADDRESS}} gibi çözülmemiş bir yer tutucuyla yayına çıkılmaz).
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRIVACY_SECTIONS, PRIVACY_LAST_UPDATED } from '../src/data/privacy.ts';
import {
  PRIVACY_DISCLAIMER,
  splitPrivacyText,
  parsePrivacyBody,
} from '../src/utils/privacyRender.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

const VALUES = {
  ENTITY_NAME: process.env.VITE_PRIVACY_ENTITY_NAME,
  ADDRESS: process.env.VITE_PRIVACY_ADDRESS,
  CONTACT_EMAIL: process.env.VITE_PRIVACY_CONTACT_EMAIL,
  HOSTING_PROVIDER: process.env.VITE_PRIVACY_HOSTING_PROVIDER,
  APP_URL: process.env.VITE_PRIVACY_APP_URL,
};

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Her {{TOKEN}}'ı çözer ve escape eder; çözülmemiş bir token varsa
// unresolvedTokens'a ekler — ilkinde durup atmak yerine TÜM eksik alanları
// tek seferde raporlayabilmek için.
function renderTextHtml(text, unresolvedTokens) {
  return splitPrivacyText(text, VALUES)
    .map((part) => {
      if (part.kind === 'text') return escapeHtml(part.text);
      if (part.resolved) return escapeHtml(part.text);
      unresolvedTokens.add(part.token);
      return '';
    })
    .join('');
}

function renderBodyHtml(body, unresolvedTokens) {
  return parsePrivacyBody(body)
    .map((para) => {
      if (para.kind === 'list') {
        const items = para.listItems.map((line) => `<li>${renderTextHtml(line, unresolvedTokens)}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${renderTextHtml(para.text, unresolvedTokens)}</p>`;
    })
    .join('\n');
}

function main() {
  const unresolvedTokens = new Set();
  const sectionsHtml = PRIVACY_SECTIONS.map(
    (section) => `<section>\n<h2>${escapeHtml(section.title)}</h2>\n${renderBodyHtml(section.body, unresolvedTokens)}\n</section>`
  ).join('\n');

  if (unresolvedTokens.size > 0) {
    const missing = [...unresolvedTokens].map((t) => `VITE_PRIVACY_${t}`).join(', ');
    throw new Error(
      `generate-privacy-page: çözülmemiş {{TOKEN}} yer tutucuları var — .env dosyasında şu değişkenler tanımlı değil: ${missing}. ` +
        `Bunlar tanımlanmadan public/gizlilik.html üretilmez.`
    );
  }

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gizlilik Politikası — VAKİT</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    padding: 24px 16px 48px;
    max-width: 640px;
    margin-left: auto;
    margin-right: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: #1c1c1c;
    background: #fdfcf9;
  }
  h1 { font-size: 1.375rem; margin-bottom: 4px; }
  .updated { font-size: 0.75rem; color: #6b6b6b; margin-bottom: 24px; }
  h2 { font-size: 1rem; color: #8a6d1d; margin: 28px 0 8px; }
  p, li { font-size: 0.9rem; }
  ul { padding-left: 20px; margin: 8px 0; }
  li { margin-bottom: 6px; }
  .disclaimer { font-size: 0.75rem; color: #6b6b6b; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e3e0d8; }
  @media (prefers-color-scheme: dark) {
    body { background: #171613; color: #ece8de; }
    .updated, .disclaimer { color: #9a968c; }
    .disclaimer { border-top-color: #322f28; }
    h2 { color: #d8b968; }
  }
</style>
</head>
<body>
<h1>Gizlilik Politikası</h1>
<p class="updated">Son güncelleme: ${escapeHtml(PRIVACY_LAST_UPDATED)}</p>
${sectionsHtml}
<p class="disclaimer">${escapeHtml(PRIVACY_DISCLAIMER)}</p>
</body>
</html>
`;

  const outPath = path.join(PROJECT_ROOT, 'public', 'gizlilik.html');
  writeFileSync(outPath, html, 'utf8');
  console.log(`Wrote ${PRIVACY_SECTIONS.length} section(s) to ${path.relative(PROJECT_ROOT, outPath)}`);
}

main();
