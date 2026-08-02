# VAKİT — Proje Özeti

## Uygulama Nedir

**VAKİT**, Google AI Studio ile başlatılmış, "Sakin ve Manevi Ezan Vakitleri, Geri Sayım ve Günlük Manevi Ritüeller Uygulaması" olarak tanımlanan bir Türkçe namaz vakitleri web uygulaması. Repo: `github.com/yasinsgrc/pray-planner`.

## Teknoloji Yığını

- **Frontend:** React 19 + TypeScript + Vite 6, Tailwind CSS 4, `motion` (animasyon), `@phosphor-icons/react` (ikonlar)
- **Vakit hesaplama:** `adhan` kütüphanesi (Diyanet, MWL, ISNA, Mısır, Karaçi, Mekke yöntemleri desteklenir)
- **Backend:** Node.js + Express (`server/`), `web-push` (gerçek push bildirimleri için), abonelik deposu (dosya tabanlı varsayılan, `DATABASE_URL` tanımlıysa Postgres)
- **Test:** Node'un yerleşik `node:test` çalıştırıcısı, `tsx` üzerinden — ek bir frontend test framework'ü yok
- **Geliştirme araçları:** `concurrently` (frontend+backend birlikte), `dotenv`

## Proje Yapısı

```
src/
  App.tsx                    — ana state, sekme yönlendirme, push bildirim bağlama
  components/                — Header, Navbar, MainCountdownRing, DailyFlowList,
                                SpiritualSettings, LocationModal, QiblaCompassModal,
                                ZikirmatikModal, LiveActivityWidgetModal, DailyInspirationCard
  hooks/useCompassHeading.ts — cihaz pusulası sensör hook'u
  utils/                     — prayerCalculator, hijri, audio, compassHeading, pushClient
  data/                      — locations.ts (81 il + populer ilçeler, ~430 kayıt), dailyContent.ts (ayet/hadis/dua)
server/                      — Express push bildirim sunucusu (abonelik, zamanlayıcı, web-push gönderimi)
public/sw.js                 — push bildirimleri için service worker
docs/superpowers/specs/      — her özellik için yazılı tasarım dokümanları
docs/superpowers/plans/      — her özellik için adım adım implementasyon planları
```

## Tamamlanan Özellikler

- **Namaz vakitleri:** Konuma göre 6 vakit (İmsak, Güneş, Öğle, İkindi, Akşam, Yatsı) + kerahet vakitleri, canlı geri sayım halkası
- **Hicri takvim** gösterimi
- **Günün ayet/hadis/dua kartı** (sabit içerik havuzundan)
- **Zikirmatik** (33/100 hedefli sayaç, titreşim + ses geri bildirimi)
- **Gece/gündüz teması** (otomatik veya manuel)
- **Web Push bildirimleri** — vakit girince veya erken uyarı anında gerçek tarayıcı bildirimi (uygulama/sekme kapalıyken de çalışır). Express backend + `web-push` + service worker ile. *main dalına alındı.*
- **Kıble pusulası — canlı cihaz yönü takibi** — telefonu çevirince ibre gerçek zamanlı döner, kıbleye hizalanınca yeşile döner + titreşim. Android `deviceorientationabsolute`/`deviceorientation` ayrımı düzeltildi, main'de.
- **PWA manifest, ikonlar** — tamamlandı (design refresh v2, B7/B8)
- **Tasarım/UX cilası** — design refresh v2 + design refinement v3 (Faz A–E) + gerçek headless-browser görsel doğrulama (`npm run visual`) ile kapsamlı revizyondan geçti

## Devam Eden / Bilinen Eksikler

- Play Store paketleme (Capacitor) hiç başlanmadı
- Store hazırlığı (gizlilik politikası, ekran görüntüleri, listing metni) yok
- `@google/genai` zaten kaldırılmıştı; `esbuild`/`autoprefixer` (kullanılmayan AI Studio şablon kalıntıları) ve mükerrer `vite` dependency girişi de temizlendi — `dotenv`/`express` gerçekten kullanılıyor, kalıntı değil

## Nasıl Çalıştırılır

```bash
npm install
cp .env.example .env          # VAPID anahtarlarını doldur (npx web-push generate-vapid-keys)
npm run dev:all                # Vite (3000) + push sunucusu (8787) birlikte
```

Testler: `npm run test:server` (backend), `node --import tsx --test "src/utils/*.test.ts"` (frontend saf fonksiyonlar)
