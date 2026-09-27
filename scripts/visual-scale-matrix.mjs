// Büyük yazı / ekran yakınlaştırma matrisi (visual-check.mjs'ten çağrılır).
//
// Font ölçeği cihazdakiyle AYNI yoldan verilir: --os-font-scale html'e
// yazılır (Android'de FontScalePlugin document-start script'i bunu yapar),
// index.css --ui-scale = clamp(1, os, 1.3) ile rem'i ölçekler. 2.0, clamp'in
// 1.3'te durduğunu kanıtlar. Dar viewport'lar "ekran yakınlaştırma"yı
// (density büyür → CSS viewport daralır) temsil eder.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export const MATRIX_VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
];
export const MATRIX_SCALES = [1, 1.15, 1.3, 2];
export const MATRIX_THEMES = ['light', 'dark'];

// Bilinçli olarak kısaltılan (text-overflow: ellipsis) metinler — bunlarda
// scrollWidth > clientWidth beklenen davranış. Başka hiçbir metin kırpılamaz.
export const INTENTIONAL_TRUNCATE_SELECTORS = [
  '[data-truncate="nearby-place-name"]', // NearbyView: yer adı (OSM adları sınırsız uzun olabilir)
];

// SpiritualSettings bildirim bölümleri yalnızca API erişilebilirken render
// edilir (useApiAvailable); matriste health yanıtı taklit edilir ki push
// onayı ve vakit-bazlı ses sheet'leri de ölçülsün.
const HEALTH_BODY = JSON.stringify({ service: 'vakit-api' });

const MAIN_TAB_SCREENS = [
  { id: 'ana-ekran', tab: 'Ana Ekran' },
  { id: 'vakitler', tab: 'Vakitler' },
  { id: 'maneviyat-ayet', tab: 'Maneviyat' },
  { id: 'maneviyat-hadis', tab: 'Maneviyat', steps: [/^Hadis$/] },
  { id: 'maneviyat-dua', tab: 'Maneviyat', steps: [/^Dua$/] },
  { id: 'kesfet-pusula', tab: 'Keşfet' },
  { id: 'kesfet-yakinimda', tab: 'Keşfet', steps: [/^Yakınımda$/] },
  { id: 'ayarlar', tab: 'Ayarlar' },
];

// Açılabilen her modal/sheet. "Destek Ol" sheet'i yalnızca VITE_SUPPORT_IBAN
// + NAME / VITE_SUPPORT_PAYMENT_URL tanımlı build'de var (SupportSection);
// visual-check build'i bunları sahte değerlerle verir.
const MODAL_SCREENS = [
  { id: 'konum-arama', tab: 'Ana Ekran', steps: [/^Konumu Değiştir$/] },
  { id: 'zikirmatik', tab: 'Ana Ekran', steps: [/^Zikirmatik$/] },
  { id: 'zikir-gecmisi', tab: 'Ana Ekran', steps: [/^Zikirmatik$/, /Geçmiş zikirler/] },
  { id: 'kerahet-bilgi', tab: 'Ana Ekran', steps: [/^kerahet$/i] },
  { id: 'bilgi-karti', tab: 'Maneviyat', steps: [/^Kerahet Vakitleri Nedir/] },
  { id: 'hakkinda', tab: 'Ayarlar', steps: [/Hakkında sayfasını aç/] },
  { id: 'lisanslar', tab: 'Ayarlar', steps: [/Hakkında sayfasını aç/, /Lisanslar/] },
  { id: 'geri-bildirim', tab: 'Ayarlar', steps: [/Geri bildirim gönder/] },
  { id: 'gizlilik', tab: 'Ayarlar', steps: [/Gizlilik politikasının tamamı/] },
  { id: 'bildirim-izni', tab: 'Ayarlar', steps: [/^Bildirimlere İzin Ver$/] },
  { id: 'bildirim-sesi', tab: 'Ayarlar', steps: [/^İmsak/] },
  { id: 'destek-ol', tab: 'Ayarlar', steps: [/^Destek Ol$/] },
].map((s) => ({ ...s, modal: true }));

export const MATRIX_SCREENS = [...MAIN_TAB_SCREENS, ...MODAL_SCREENS];

async function clickByName(page, name) {
  // Tetikleyiciler button / tab / link olabiliyor; son açılan dialog varsa
  // aramayı onunla sınırla (örn. Hakkında içindeki Lisanslar).
  const dialog = page.locator('[role="dialog"]').last();
  const scope = (await dialog.count()) > 0 ? dialog : page;
  for (const role of ['button', 'tab', 'radio', 'link']) {
    const loc = scope.getByRole(role, { name }).first();
    if ((await loc.count()) > 0) {
      await loc.scrollIntoViewIfNeeded();
      await loc.click();
      return true;
    }
  }
  return false;
}

async function openScreen(page, screen) {
  await page.getByRole('tab', { name: screen.tab, exact: true }).click();
  await page.waitForTimeout(350);
  for (const step of screen.steps ?? []) {
    if (!(await clickByName(page, step))) throw new Error(`tetikleyici bulunamadı: ${step}`);
    await page.waitForTimeout(450);
  }
  if (screen.modal) {
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    await page.waitForTimeout(450); // sheet giriş yayı
  }
  // Giriş animasyonları (örn. halkanın .animate-blur-up scale'i) bitmeden
  // getBoundingClientRect dönüşümlü kutuyu verir; sonsuz olanlar hariç bekle.
  // Sekme geçişinde yeni içerik çıkış animasyonundan SONRA bağlanır; tek
  // seferlik bir anlık görüntü o animasyonu kaçırır — sonlu animasyon
  // kalmayana kadar tekrarla.
  await page.evaluate(async () => {
    const finite = () =>
      document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity && a.playState !== 'finished');
    for (let i = 0; i < 20; i++) {
      const pending = finite();
      if (pending.length === 0) {
        await new Promise((r) => setTimeout(r, 100));
        if (finite().length === 0) return;
        continue;
      }
      await Promise.all(pending.map((a) => a.finished.catch(() => {})));
    }
  });
}

// Tek ekran için kesin ölçümler (a–f); sayfa bağlamında çalışır.
function measureScreen({ isModal, isHome, truncateSelectors, dialInnerRatio }) {
  const out = [];
  const de = document.documentElement;
  const describe = (el) => {
    const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `<${el.tagName.toLowerCase()}${el.dataset.testid ? ` data-testid=${el.dataset.testid}` : ''}> "${t}"`;
  };

  // a) Yatay taşma yok.
  if (de.scrollWidth !== de.clientWidth) {
    out.push(`a) yatay taşma: documentElement.scrollWidth=${de.scrollWidth} != clientWidth=${de.clientWidth}`);
  }

  // b) Görünür metin kutuları kırpılmıyor. Aday: kendisi inline olmayan ve
  // doğrudan metin ya da metin taşıyan inline çocuk içeren eleman. Kaydırma
  // kapsayıcıları (overflow-x auto/scroll) bilerek taşar, hariç.
  const root = isModal ? [...document.querySelectorAll('[role="dialog"]')].pop() : document.body;
  const truncateAllowed = (el) => truncateSelectors.some((sel) => el.closest(sel));
  // Dokunma alanı uzantıları (before:absolute before:-inset-*, içerik '')
  // metin değil ama scrollWidth'e girer; ölçüm süresince yalnızca bunlar
  // gizlenir. Koşul pseudo başına ayrı: position:absolute VE content boş
  // string (metin yok). Aynı elemanın öteki pseudo'su metin taşıyorsa
  // gizlenmez (negatif kontrol: neg-pseudo-text).
  const HIT_AREA_ATTR = { '::before': 'data-measure-hitarea-before', '::after': 'data-measure-hitarea-after' };
  const hitAreaStyle = document.createElement('style');
  hitAreaStyle.textContent =
    '[data-measure-hitarea-before]::before,[data-measure-hitarea-after]::after{display:none!important}';
  for (const el of root.querySelectorAll('*')) {
    for (const [pseudo, attr] of Object.entries(HIT_AREA_ATTR)) {
      const ps = getComputedStyle(el, pseudo);
      if (ps.position === 'absolute' && (ps.content === '""' || ps.content === "''")) el.setAttribute(attr, '');
    }
  }
  document.head.appendChild(hitAreaStyle);
  for (const el of root.querySelectorAll('*')) {
    if (!(el instanceof HTMLElement)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'inline' || cs.display === 'contents' || cs.display === 'none') continue;
    if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;
    const carriesText = [...el.childNodes].some(
      (n) =>
        (n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== '') ||
        (n instanceof HTMLElement && getComputedStyle(n).display === 'inline' && n.textContent.trim() !== '')
    );
    if (!carriesText) continue;
    if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: false })) continue;
    if (el.closest('.sr-only') || el.closest('[data-testid="ring-measure"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (truncateAllowed(el)) continue;
    if (el.scrollWidth > el.clientWidth) {
      out.push(`b) metin kırpılıyor: ${describe(el)} scrollWidth=${el.scrollWidth} > clientWidth=${el.clientWidth}`);
    }
  }
  hitAreaStyle.remove();
  for (const attr of Object.values(HIT_AREA_ATTR)) {
    for (const el of root.querySelectorAll(`[${attr}]`)) el.removeAttribute(attr);
  }

  // c) Ana ekran: halka içi metin iç dairede YA DA blok halkanın altında.
  if (isHome) {
    const shell = document.querySelector('[data-testid="ring-shell"]');
    const below = document.querySelector('[data-testid="ring-content-below"]');
    const s = shell.getBoundingClientRect();
    if (below) {
      const b = below.getBoundingClientRect();
      if (b.top < s.bottom) out.push(`c) halka altı blok (top=${b.top.toFixed(1)}) halka tabanının (${s.bottom.toFixed(1)}) üstünde`);
    } else {
      const parts = ['ring-label-top', 'countdown', 'ring-label-bottom'].map((id) =>
        shell.querySelector(`[data-testid="${id}"]`).getBoundingClientRect()
      );
      const left = Math.min(...parts.map((p) => p.left));
      const right = Math.max(...parts.map((p) => p.right));
      const top = Math.min(...parts.map((p) => p.top));
      const bottom = Math.max(...parts.map((p) => p.bottom));
      const cx = s.left + s.width / 2;
      const cy = s.top + s.height / 2;
      const innerR = (s.width * dialInnerRatio) / 2;
      const far = Math.max(
        ...[[left, top], [right, top], [left, bottom], [right, bottom]].map(([x, y]) => Math.hypot(x - cx, y - cy))
      );
      if (far > innerR) {
        out.push(`c) halka içi metin kutusu (${(right - left).toFixed(1)}x${(bottom - top).toFixed(1)}) iç daireyi (r=${innerR.toFixed(1)}) aşıyor: en uzak köşe ${far.toFixed(1)}`);
      }
    }
  }

  // d) Navbar etiketleri birbirine değmiyor; e) içerik navbar kutusunda.
  const nav = document.querySelector('nav[role="tablist"]');
  const tabs = [...nav.querySelectorAll('[role="tab"]')];
  // Sığmadığında yalnızca aktif sekmenin etiketi render edilir; diğerleri
  // ikon + aria-label.
  const labels = tabs
    .map((t) => t.querySelector('[data-nav-label]'))
    .filter((l) => l && l.checkVisibility({ visibilityProperty: true }) && l.getBoundingClientRect().width > 0);
  const lr = labels.map((l) => l.getBoundingClientRect());
  for (let i = 1; i < lr.length; i++) {
    const a = lr[i - 1];
    const b = lr[i];
    if (a.right > b.left && a.bottom > b.top && b.bottom > a.top) {
      out.push(`d) navbar etiketleri çakışıyor: "${labels[i - 1].textContent}" (right=${a.right.toFixed(1)}) ∩ "${labels[i].textContent}" (left=${b.left.toFixed(1)})`);
    }
  }
  const n = nav.getBoundingClientRect();
  for (const t of tabs) {
    const r = t.getBoundingClientRect();
    if (r.top < n.top || r.bottom > n.bottom || r.left < n.left || r.right > n.right) {
      out.push(`e) navbar sekmesi "${t.textContent}" navbar kutusunun dışında (${r.top.toFixed(1)}..${r.bottom.toFixed(1)} / nav ${n.top.toFixed(1)}..${n.bottom.toFixed(1)})`);
    }
    if (t.scrollHeight > t.clientHeight) {
      out.push(`e) navbar sekmesi "${t.textContent}" içeriği kutusunu aşıyor: scrollHeight=${t.scrollHeight} > clientHeight=${t.clientHeight}`);
    }
    if (!t.querySelector('[data-nav-label]')?.checkVisibility() && !t.getAttribute('aria-label')) {
      out.push(`g) etiketi görünmeyen navbar sekmesinin aria-label'ı yok`);
    }
  }

  // g) Görünür navbar etiketleri >= 11px · ui-scale (0.6875rem). ui-scale =
  // html font-size / 16. Karşılaştırma 0.01px çözünürlükte (float gürültüsü
  // 11·1.3 = 14.300000000000001 gibi değerleri yanlış kırmızıya çevirmesin).
  const uiScale = parseFloat(getComputedStyle(de).fontSize) / 16;
  const minLabelPx = Math.round(11 * uiScale * 100);
  for (const l of labels) {
    const fs = parseFloat(getComputedStyle(l).fontSize);
    if (Math.round(fs * 100) < minLabelPx) {
      out.push(`g) navbar etiketi 11px·ölçek altında: ${describe(l)} font-size=${fs}px < ${(minLabelPx / 100).toFixed(2)}px`);
    }
  }

  // h) Header: konum adı kısaltılmıyor (yatayda taşmıyor, line-clamp'e
  // rağmen tüm satırlar görünür) ve ikon butonları >= 44x44.
  const header = document.querySelector('header');
  if (header && !isModal) {
    for (const el of header.querySelectorAll('[data-header-location]')) {
      if (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) {
        out.push(`h) konum adı kesiliyor: ${describe(el)} scroll ${el.scrollWidth}x${el.scrollHeight} > client ${el.clientWidth}x${el.clientHeight}`);
      }
    }
    for (const b of header.querySelectorAll('button')) {
      if (b.getAttribute('aria-label') === 'Konumu Değiştir') continue;
      const r = b.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) {
        out.push(`h) header ikon butonu 44px altında: ${describe(b)} "${b.getAttribute('aria-label')}" ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
      }
    }
  }

  // f) Modal: kapat butonu tamamen görünür (içerik uzunsa kayan alan içinde).
  if (isModal) {
    const dialog = root;
    const close = [...dialog.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Kapat');
    if (!close) {
      out.push('f) modalda "Kapat" butonu yok');
    } else {
      const c = close.getBoundingClientRect();
      if (c.top < 0 || c.left < 0 || c.bottom > innerHeight || c.right > innerWidth) {
        out.push(`f) "Kapat" butonu ekran dışında (${c.left.toFixed(1)},${c.top.toFixed(1)} → ${c.right.toFixed(1)},${c.bottom.toFixed(1)})`);
      }
    }
  }
  return out;
}

// Negatif kontrol: ölçüm kodunun gerçekten yakaladığını kanıtlayan, bilerek
// bozuk bir sayfa. Beklenen her ihlal (data-testid ile) bulunmalı; pozitif
// kontrol (yalnızca boş dokunma alanı uzantısı taşan eleman) ihlal
// üretmemeli. Tutmazsa kapı KIRMIZI döner — istisnalar gerçek taşmayı
// örtemez.
const NEGATIVE_CONTROL_HTML = `<!doctype html><html lang="tr"><head><style>
  html { font-size: 16px; }
  body { margin: 0; font: 16px/1.25 sans-serif; }
  .box { width: 60px; white-space: nowrap; }
  .clip { overflow: hidden; }
  .rel { position: relative; }
  #pseudo-text::after { content: 'GİZLENMEMESİ GEREKEN UZUN METİN'; position: absolute; left: 0; top: 0; white-space: nowrap; }
  #pseudo-text::before, #hitarea-only::before { content: ''; position: absolute; left: -12px; right: -40px; top: -12px; bottom: -12px; }
  #loc { width: 60px; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-size: 12px; line-height: 16px; }
  nav [data-nav-label] { font-size: 9px; }
</style></head><body>
  <header>
    <button aria-label="Konumu Değiştir"><div id="loc" data-header-location data-testid="neg-header-location">Çok Uzun Bir İlçe Adı • Çok Uzun Bir Şehir Adı Daha</div></button>
    <button aria-label="Küçük İkon" data-testid="neg-small-icon" style="width:30px;height:30px;padding:0">x</button>
  </header>
  <div class="box clip" data-testid="neg-overflow-text">Bu metin kutusuna kesinlikle sığmayan uzun bir cümle</div>
  <div id="pseudo-text" class="box clip rel" data-testid="neg-pseudo-text">kısa</div>
  <div id="hitarea-only" class="box clip rel" data-testid="pos-hitarea-only">kısa</div>
  <nav role="tablist" style="display:flex">
    <button role="tab" aria-selected="true"><span data-nav-label data-testid="neg-nav-label">ANA</span></button>
    <button role="tab" aria-selected="false"><span data-nav-label>İKİ</span></button>
  </nav>
</body></html>`;

// [kontrol, data-testid] — ihlal o kontrolün harfiyle başlamalı.
const NEGATIVE_CONTROL_EXPECTED = [
  ['b', 'neg-overflow-text'], // düz metin taşması
  ['b', 'neg-pseudo-text'], // metinli ::after taşması — ::before boş dokunma alanı olsa da gizlenmemeli
  ['g', 'neg-nav-label'], // navbar etiketi 11px·ölçek altında
  ['h', 'neg-header-location'], // konum adı 2 satıra sığmıyor
  ['h', 'neg-small-icon'], // header ikon butonu 44px altında
];

export async function checkNegativeControl(browser, { violations, dialInnerRatio }) {
  console.log('\n=== Ölçüm negatif kontrolü (bilerek taşan sayfa → ihlal beklenir) ===');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.setContent(NEGATIVE_CONTROL_HTML);
    const found = await page.evaluate(measureScreen, {
      isModal: false,
      isHome: false,
      truncateSelectors: INTENTIONAL_TRUNCATE_SELECTORS,
      dialInnerRatio,
    });
    for (const [check, id] of NEGATIVE_CONTROL_EXPECTED) {
      if (!found.some((f) => f.startsWith(`${check})`) && f.includes(`data-testid=${id}`))) {
        violations.push(`[negatif-kontrol] ${id} için ${check}) ihlali bekleniyordu, ölçüm yakalamadı (bulunanlar: ${found.join(' | ') || 'yok'})`);
      }
    }
    for (const f of found.filter((f) => f.includes('data-testid=pos-'))) {
      violations.push(`[negatif-kontrol] pozitif kontrol ihlal üretmemeliydi: ${f}`);
    }
    console.log(`  ${found.length} ihlal üretildi, ${NEGATIVE_CONTROL_EXPECTED.length} beklenen kontrol edildi`);
  } finally {
    await context.close();
  }
}

async function setTheme(page, theme) {
  await page.getByRole('tab', { name: 'Ayarlar', exact: true }).click();
  await page.waitForTimeout(300);
  await clickByName(page, theme === 'dark' ? /^Koyu$/ : /^Açık$/);
  await page.waitForTimeout(300);
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (isDark !== (theme === 'dark')) throw new Error(`tema ${theme} uygulanamadı`);
}

export async function checkScaleMatrix(
  browser,
  {
    baseUrl,
    violations,
    time,
    outDir,
    dialInnerRatio,
    viewports = MATRIX_VIEWPORTS,
    scales = MATRIX_SCALES,
    themes = MATRIX_THEMES,
    screens = MATRIX_SCREENS,
  }
) {
  await checkNegativeControl(browser, { violations, dialInnerRatio });
  console.log('\n=== Büyük yazı / ekran yakınlaştırma matrisi (4 viewport x 4 ölçek x 2 tema x tüm ekranlar) ===');
  let screensChecked = 0;
  let retries = 0;
  for (const viewport of viewports) {
    for (const scale of scales) {
      for (const theme of themes) {
        const combo = `${viewport.width}x${viewport.height}@${scale}-${theme}`;
        const context = await browser.newContext({ viewport, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
        await context.route('**/health', (route) =>
          route.fulfill({ status: 200, contentType: 'application/json', body: HEALTH_BODY })
        );
        // Cihazdaki FontScalePlugin document-start script'inin aynısı.
        await context.addInitScript((s) => {
          const apply = () => document.documentElement.style.setProperty('--os-font-scale', String(s));
          if (document.documentElement) apply();
          else new MutationObserver((_, o) => { if (document.documentElement) { apply(); o.disconnect(); } }).observe(document, { childList: true });
        }, scale);
        // page.clock yeniden yüklemeden sonra ilerlemiyor (sekme geçiş
        // animasyonu bitmiyor); temiz durum gerektiğinde yeni sayfa açılır.
        const freshPage = async () => {
          const pg = await context.newPage();
          pg.setDefaultTimeout(5000);
          await pg.clock.install({ time: new Date(time).getTime() });
          await pg.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
          await pg.waitForTimeout(600);
          return pg;
        };
        let page;
        try {
          page = await freshPage();
          const applied = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
          const expected = `${(16 * Math.min(Math.max(scale, 1), 1.3)).toFixed(1).replace(/\.0$/, '')}px`;
          if (applied !== expected) violations.push(`[scale-matrix/${combo}] html font-size ${applied}, beklenen ${expected}`);
          await setTheme(page, theme);

          for (const screen of screens) {
            const label = `[scale-matrix/${screen.id}/${combo}]`;
            try {
              try {
                await openScreen(page, screen);
              } catch (err) {
                // page.clock'lu sayfa yük altında ara sıra takılıyor (sekme
                // içeriği gelmiyor). Yeni sayfada BİR kez yeniden dene;
                // gerçek bir eksik tetikleyici ikinci denemede de düşer.
                console.log(`  ${label} yeniden deneniyor: ${err.message.split('\n')[0]}`);
                retries++;
                await page.close();
                page = await freshPage();
                await openScreen(page, screen);
              }
              const found = await page.evaluate(measureScreen, {
                isModal: !!screen.modal,
                isHome: screen.id === 'ana-ekran',
                truncateSelectors: INTENTIONAL_TRUNCATE_SELECTORS,
                dialInnerRatio,
              });
              for (const f of found) violations.push(`${label} ${f}`);
              const dir = path.join(outDir, screen.id);
              await mkdir(dir, { recursive: true });
              await page.screenshot({ path: path.join(dir, `${viewport.width}x${viewport.height}@${scale}-${theme}.png`) });
              screensChecked++;
            } catch (err) {
              violations.push(`${label} ekran açılamadı/ölçülemedi: ${err.message.split('\n')[0]}`);
            }
            // Her ekran temiz durumdan başlasın: açık dialog Escape ile
            // kapanmazsa yeni sayfa (tema localStorage'da, ölçek init
            // script'te korunur).
            for (let i = 0; i < 3 && (await page.locator('[role="dialog"]').count()) > 0; i++) {
              await page.keyboard.press('Escape');
              await page.waitForTimeout(500);
            }
            if ((await page.locator('[role="dialog"]').count()) > 0) {
              await page.close();
              page = await freshPage();
            }
          }
        } catch (err) {
          violations.push(`[scale-matrix/${combo}] kombinasyon başarısız: ${err.message.split('\n')[0]}`);
        } finally {
          await context.close();
        }
      }
    }
  }
  console.log(`  ${screensChecked} ekran ölçüldü (${retries} yeniden deneme); ekran görüntüleri: ${outDir}`);
}
