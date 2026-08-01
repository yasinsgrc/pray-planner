# VAKİT — Proje Özeti

## Uygulama Nedir

**VAKİT**, Google AI Studio ile başlatılmış, "Sakin ve Manevi Ezan Vakitleri, Geri Sayım ve Günlük Manevi Ritüeller Uygulaması" olarak tanımlanan bir Türkçe namaz vakitleri web uygulaması. Repo: `github.com/yasinsgrc/pray-planner`.

## Teknoloji Yığını

- **Frontend:** React 19 + TypeScript + Vite 6, Tailwind CSS 4, `motion` (animasyon), `lucide-react` (ikonlar)
- **Vakit hesaplama:** `adhan` kütüphanesi (Diyanet, MWL, ISNA, Mısır, Karaçi, Mekke yöntemleri desteklenir)
- **Backend:** Node.js + Express (`server/`), `web-push` (gerçek push bildirimleri için), JSON dosya tabanlı abonelik deposu
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
  data/                      — locations.ts (16 sabit şehir), dailyContent.ts (ayet/hadis/dua)
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
- **Kıble pusulası — canlı cihaz yönü takibi** — telefonu çevirince ibre gerçek zamanlı döner, kıbleye hizalanınca yeşile döner + titreşim. `feature/qibla-live-compass` dalında, henüz main'e alınmadı — bir kritik düzeltme (Android'de mutlak/relative açı sorunu) bekliyor.

## Devam Eden / Bilinen Eksikler

- Kıble pusulası: Android'de `deviceorientationabsolute` yerine düz `deviceorientation` dinlendiği için ibre gerçek kuzeye değil keyfi bir referansa göre dönebilir — düzeltme sürüyor
- Konum sistemi hâlâ 16 sabit şehirle sınırlı, serbest arama/geocoding yok
- PWA manifest, ikonlar, Play Store paketleme (Capacitor) hiç başlanmadı
- Tasarım/UX cilası yapılmadı
- Store hazırlığı (gizlilik politikası, ekran görüntüleri) yok
- `@google/genai`, `express`(bir kısmı artık kullanılıyor), `dotenv` gibi AI Studio şablonundan kalma bazı bağımlılıklar hâlâ kısmen kullanılmıyor

## Nasıl Çalıştırılır

```bash
npm install
cp .env.example .env          # VAPID anahtarlarını doldur (npx web-push generate-vapid-keys)
npm run dev:all                # Vite (3000) + push sunucusu (8787) birlikte
```

Testler: `npm run test:server` (backend), `node --import tsx --test "src/utils/*.test.ts"` (frontend saf fonksiyonlar)
