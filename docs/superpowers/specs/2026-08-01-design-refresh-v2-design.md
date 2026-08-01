# Design Refresh v2 — Token System, Signature Dial, Bug Fixes

## Problem

The design-refresh-phase-1 branch (merged, `5d030e1`) added glass material and
motion polish, but a full audit turned up structural problems that polish
alone doesn't fix: dark mode's gold tone never actually applies (colors are
hex-literal, not token-driven), several real functional bugs (recompute
storm, wrong auto-theme heuristic, content behind the navbar), no PWA
manifest despite the app depending on Web Push (which requires an installed
PWA on iOS), missing accessibility baseline, and three of the four screens
read as generic/unfinished. The "Maneviyat" tab in particular is the
weakest — a single card floating in `justify-center` with two link buttons.

## Goals

- Replace every hardcoded color literal with a token system so dark mode's
  gold (`#E5B757`) actually renders, and so an accent color can track the
  active prayer at runtime.
- Fix nine concrete functional bugs (B1–B9 below) uncovered during the
  audit — recompute storm, wrong auto-theme heuristic, missing PWA files,
  content hidden behind the navbar, hardcoded kerahet copy, etc.
- Give the app one confident signature element (the "Gün Kavisi Kadranı" —
  a 24-hour sun-position dial) rather than spreading effort thin across many
  small decorations. Everything else stays quiet.
- Redesign the two weakest screens (Vakitler's missing timeline, Maneviyat's
  empty layout) and replace native `<select>` controls with in-brand
  segmented controls / bottom sheets.
- Establish an accessibility baseline: focus rings, tablist semantics,
  `aria-live` countdown, contrast-checked secondary text, 44px touch targets.

## Non-Goals / Explicit Constraints

- Prayer-time calculation logic (`adhan` usage, `prayerCalculator.ts`'s
  output contract) does not change.
- Push backend (`server/*`) and `public/sw.js` push behavior do not change.
- Existing tests are not touched except where a fix's own tests are added.
- No new UI component library — bottom sheets and segmented controls are
  built with the existing `motion` dependency, not a new package.

## Phasing

This is too large for one implementation plan. It is delivered as five
sequential phases, each with its own plan document, its own commit(s), and
its own checkpoint: `tsc --noEmit` clean, `npm run build` clean, a written
self-critique ("what makes this screen different from a generic app?"), and
the user's own visual review in a running `npm run dev` (no browser/
screenshot tool is available in this environment, so visual QA is the
user's step, not an automated one).

1. **Faz 1 — Foundation.** Token system (color + typography), self-hosted
   variable fonts, global app shell (max-width, safe-area, FOUC-free theme
   init), B1–B2 and B4–B8 bug fixes, accessibility baseline.
2. **Faz 2 — Signature.** Gün Kavisi Kadranı (24h sun-position dial) +
   home-screen ("Ana Ekran") rhythm fix.
3. **Faz 3 — Vakitler.** Left-side timeline backbone, kerahet segments
   driven by `kerahetTimes` data (B3) instead of hardcoded JSX copy, "Yarın"
   summary.
4. **Faz 4 — Maneviyat + Ayarlar.** Bottom-sheet pickers replacing native
   `<select>` (B10), segmented controls, section grouping, richer Maneviyat
   content (Share, live Kıble/Zikirmatik previews).
5. **Faz 5 — Modals + motion unification.** Modals become bottom sheets
   with focus trap / `Escape` / scroll lock / exit animation (B9); one
   shared motion vocabulary end to end; final whole-app critique pass.

## Design Tokens (all phases draw from this)

### Color

```css
:root {
  /* per-prayer accent palette ("Gün Kavisi") */
  --v-imsak: #4A5A7B;
  --v-gunes: #E3A857;
  --v-ogle: #D6A84D;
  --v-ikindi: #C08A46;
  --v-aksam: #A85D52;
  --v-yatsi: #2F3A56;

  --gold: #D6A84D;
  --sand: #E8C68C;
  --paper: #F9F7F2;
  --surface: #FFFFFF;
  --surface-2: #F2EFE7;
  --ink: #23262B;
  --ink-2: #5A5850; /* recomputed for >=4.5:1 on --paper during Faz 1 */
  --hairline: rgba(35, 38, 43, 0.08);
  --accent: var(--v-ogle); /* App.tsx sets this to the active prayer's
                               --v-* value on every schedule recompute */
}
.dark {
  --gold: #E5B757;
  --sand: #C9A25E;
  --paper: #14161A;
  --surface: #1D2026;
  --surface-2: #24272E;
  --ink: #ECEAE3;
  --ink-2: #ABA89F; /* recomputed for >=4.5:1 on --paper during Faz 1 */
  --hairline: rgba(236, 234, 227, 0.10);
}
```

Tailwind v4 `@theme` block maps these to utilities so call sites use
`text-gold`, `bg-accent/10`, `border-hairline` instead of `text-[#D6A84D]`:

```css
@theme {
  --color-gold: var(--gold);
  --color-sand: var(--sand);
  --color-accent: var(--accent);
  --color-paper: var(--paper);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-ink: var(--ink);
  --color-ink-2: var(--ink-2);
  --color-hairline: var(--hairline);
}
```

Every `#D6A84D`, `#E8C68C`, `#2D2D2D`/`#23262B`, and `--mist`-based literal
across `src/components/*` and `src/index.css` is replaced with the
corresponding token during Faz 1 (B1).

### Typography

- Display/serif: **Fraunces** (variable, `opsz`+`wght`) — screen titles,
  prayer names, verse text.
- Body/UI: **Plus Jakarta Sans** (variable, `wght`) — labels, buttons,
  descriptions, `tabular-nums` for the countdown.
- Both confirmed to ship a `latin-ext` subset (verified against each font's
  Google Fonts `METADATA.pb`), which covers Turkish glyphs (ı İ ş ğ ç ö ü).
- Self-hosted as variable `.woff2` files under `public/fonts/`, loaded via
  `@font-face` with `font-display: swap`, `latin` + `latin-ext` unicode
  ranges only. The existing Google Fonts `<link>` tags in `index.html` are
  removed.
- Fluid scale (`clamp`): `display-xl` (countdown) `clamp(3.25rem, 16vw,
  4.5rem)`, `display-l` (screen titles) `clamp(1.5rem, 6vw, 1.875rem)`,
  `title` `1.0625rem`, `body` `0.875rem`, `label` `0.75rem` +
  `0.06em` letter-spacing uppercase, `micro` `0.6875rem`.

### Shape / Spacing

4px base grid. Interactive elements `rounded-full`; cards `20px`;
sheets `28px` top corners. Elevation comes from `--hairline` borders plus a
`--surface`/`--paper` tone step, not `box-shadow` (existing card stacks
currently blur together under `shadow-sm`). `.glass-panel` keeps its
current background-+-blur-only shape (documented reason: avoids the
border/box-shadow specificity conflict already solved in Phase 1) and gains
an `@supports not (backdrop-filter: blur(1px))` solid-background fallback.

## Signature Element — Gün Kavisi Kadranı

Replaces the home screen's generic progress ring. Full day (imsak → next
imsak), not "time remaining to next prayer":

- 6 tick marks placed at each prayer's true solar angle for that day
  (so summer/winter days visibly differ — this is intentional).
- Elapsed arc: multi-stop `conic-gradient` through the six `--v-*` colors
  in order; remaining arc: flat `--hairline`.
- Kerahet windows render as a hatched/dashed segment directly on the arc
  (see Faz 3 — this replaces the current orange alert-box treatment).
- Current-time marker: filled circle by day, crescent by night; moves via
  CSS `transition`, updated once per minute (not per animation frame —
  battery consideration). Only the center digits re-render every second.
- Center: `display-xl` tabular countdown, small eyebrow ("İKİNDİYE KALAN"),
  active-prayer chip below.
- Mount animation: one 900ms expo-out `stroke-dashoffset` sweep to the
  real position, center text blurs up. `prefers-reduced-motion` skips
  straight to the final state.
- Built with inline SVG, `<defs>`/gradient, `vector-effect:
  non-scaling-stroke`.

```
              N (imsak <-> yatsi dönüm noktası, gece rengi)
         \  · tick            tick ·  /
      \  imsak                  yatsi  /
    \                                    /
   |         .------------------.         |
   |       .-'   (hairline,     '-.       |
   |      |    gelecek kısım)      |      |
gunes    |   #===============>--  |    yatsı
(tick)   |   :  vakit renkleri  :   |   (tick)
   |      |  :   gradient yayı  :  |      |
   |       '-|                 |-'       |
   |         |   İKİNDİYE KALAN |         |
    \        |    03:12:47      |        /
      \      |  # Öğle vaktind. |      /
         \   '------------------'   /
              ogle · ikindi · aksam
                 (tick'ler, gerçek açıda)

   [tarama deseni] = kerahet segmenti, yayın üzerinde
   #   = şu anki an işaretçisi (gündüz: dolu daire, gece: hilal)
```

## Bug Fixes (mapped to phase)

**Faz 1:**
- **B1** — hardcoded color literals → tokens (all components).
- **B2** — `Header.tsx`'s hicri date uses `hidden sm:block`; becomes
  visible at all breakpoints, plus a Gregorian date strip beneath the
  header (`1 Ağustos 2026, Cumartesi · 17 Safer 1448`).
- **B4** — `App.tsx`'s `schedule` `useMemo` depends on `now`, recomputing
  full prayer times every second. Split into (a) a `useMemo` keyed on
  `location + calculationMethod + YYYY-MM-DD` that computes the day's six
  prayer times once, and (b) a lightweight per-tick derivation of
  `activePrayer`/`nextPrayer`/remaining-time/`ringProgress` from that fixed
  schedule.
- **B5** — `themeMode: 'auto'` currently checks `hour >= 20 || hour < 6`.
  Switches to the day's real maghrib/fajr times (already computed by
  `calculatePrayerTimes`) with a smooth `transition`.
- **B6** — Settings screen's last card clips behind the fixed navbar.
  Global `padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) +
  24px)`.
- **B7** — `package.json`'s `"name": "react-example"` template artifact →
  `"vakit"` with a real description/version; unused `@google/genai`
  dependency removed (confirmed unused — no imports anywhere in `src/` or
  `server/`).
- **B8** — PWA: `manifest.webmanifest` (`name`/`short_name: "VAKİT"`,
  `display: standalone`, `lang: tr`, `orientation: portrait`, 192/512 +
  maskable icons), light/dark `theme-color` via separate `media` queries,
  `apple-touch-icon`, `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, `viewport-fit=cover`,
  description/OG tags. FOUC fix: an inline `<head>` script reads the saved
  theme from `localStorage` and applies `.dark` before React mounts.
- **Accessibility baseline** — global `:focus-visible` ring using
  `var(--accent)`; `Navbar` gets `role="tablist"` / `role="tab"` /
  `aria-selected` / `aria-controls`; countdown gets an `aria-hidden` visual
  value plus an `sr-only` `aria-live="polite"` region updated only when the
  formatted minute changes (not every second); every icon-only button gets
  `aria-label`; `--ink-2` is tuned to clear 4.5:1 against `--paper`/`--surface`
  in both themes; touch targets audited to ≥44×44px.

**Faz 3:** B3 — `DailyFlowList.tsx` destructures `kerahetTimes` but never
uses it; the three kerahet blocks are hardcoded JSX with hardcoded "45 dk"
copy. Faz 3 renders them from `kerahetTimes` (real start–end times, e.g.
"04:08–04:53") as part of the new timeline backbone.

**Faz 4:** B10 — native `<select>` controls (prayer sound picker,
calculation-method picker) replaced with bottom-sheet pickers.

**Faz 5:** B9 — modals get focus trap, `Escape`-to-close, body scroll lock,
backdrop click, and an actual exit animation (currently `if (!isOpen)
return null` — instant unmount, no exit transition).

## Motion Vocabulary (all phases)

Single shared language, introduced in `index.css`/a small motion-tokens
module and reused everywhere: ease `cubic-bezier(0.16, 1, 0.3, 1)`
(expo-out, already used by `FadeIn`); durations micro 150ms, entrance
400–600ms, dial sweep 900ms; stagger 60ms; `hover:scale-[1.02]
active:scale-[0.97]` only on truly pressable elements; one orchestrated
load sequence per screen, then stillness (no continuously-looping
animation beyond the existing `animate-pulse` dot). `MotionConfig
reducedMotion="user"` wraps the app root so `prefers-reduced-motion`
disables all `motion` components globally in one place, replacing the
current per-component reduced-motion handling.

## Testing / Verification

No new automated frontend test framework is introduced (matches existing
project convention — verification is `tsc --noEmit` + `npm run build` +
manual review, as used throughout this project's prior features). Each
phase's plan defines its own concrete verification steps. Where a fix has
a natural unit-testable boundary (e.g. the `useMemo` split in B4, the
auto-theme sunset/fajr boundary in B5), the implementing task adds a
focused test using the project's existing `node --import tsx --test`
convention (currently used only under `server/`; a frontend-logic test
under `src/utils/*.test.ts` run the same way is acceptable since it tests
pure functions, not DOM).
