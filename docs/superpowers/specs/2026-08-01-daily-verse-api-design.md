# Günün Ayeti API Bağlantısı + İçerik Havuzu Genişletme — Tasarım

## Amaç

"Manevi" sekmesindeki günün ayet/hadis/dua kartı, sadece 4 statik kayıttan dönüyor ve sık tekrar ediyor. Bu tasarım: (1) ayet kısmını UmmahAPI'den (Türkçe meal destekli, ücretsiz, API anahtarı gerektirmeyen) canlı ve günlük olarak çeker; (2) hadis/dua için Türkçe API bulunamadığı (araştırıldı, doğrulandı — UmmahAPI'de hadis/dua Türkçe çeviri yok, rastgele dua uygunsuz kategoriye düşebiliyor) için statik havuzu 4'ten 10 kayda çıkararak tekrar sıklığını azaltır.

## Araştırma Bulguları

- `GET https://ummahapi.com/api/quran/random` → `data.verse.translations.turkish` alanında gerçek Türkçe meal var, canlı test edildi, çalışıyor.
- `GET https://ummahapi.com/api/hadith/random` → yalnızca `arabic`/`english`, Türkçe yok; `lang=tr` parametresi etkisiz (canlı test edildi).
- `GET https://ummahapi.com/api/duas/random` → yalnızca İngilizce `translation`, ayrıca rastgele seçim "evlilik/mahremiyet" gibi genele uygun olmayan kategorilere düşebiliyor (canlı testte gözlendi).
- Deterministik bir "günün ayeti" endpoint'i yok — her çağrıda farklı rastgele ayet döner. Bu yüzden backend'de tarihe göre cache gerekir (aynı gün içinde herkese aynı ayet).

## Mimari

```
[DailyInspirationCard.tsx]
   │ mount'ta fetch
   ▼
GET /api/daily-verse
   │
   ▼
[server/dailyVerse.ts] createDailyVerseService(fetchImpl?, now?)
   │  tarihe göre in-memory cache (aynı gün → tekrar istek atmaz)
   ▼
UmmahAPI /api/quran/random → surah.number + verse.translations.turkish
   │
   ▼
TÜRKÇE_SURE_ADLARI[surah.number - 1] (114 surenin Türkçe adı, statik dizi)
   ▼
{ verse: "...", verseRef: "<Sure Adı> Suresi, <ayet no>. Ayet" }
```

- **`server/dailyVerse.ts`**: `createDailyVerseService(deps: {fetchImpl?, now?}): { getVerseOfTheDay(): Promise<DailyVerse> }`. UmmahAPI'nin İngilizce sure adı döndürmesi nedeniyle, 114 surenin Türkçe adını içeren statik bir dizi (`TURKISH_SURAH_NAMES`) ile eşlenir. Aynı takvim günü içindeki tekrar çağrılar cache'den döner (yalnızca ilk çağrı gerçek ağ isteği yapar) — bu, `server/scheduler.ts`'teki gün-anahtarlı önbellekleme deseniyle tutarlıdır.
- **`server/app.ts`**: `GET /api/daily-verse` route'u eklenir, 200 → `{verse, verseRef}`, 502 → UmmahAPI/ağ hatası.
- **`src/components/DailyInspirationCard.tsx`**: mount'ta `/api/daily-verse`'i çağırır; API henüz yüklenmemişse veya başarısız olursa, mevcut statik havuzun gün-indeksli `verse`/`verseRef` alanına düşer (asla boş göstermez). "Hadis" ve "Dua" sekmeleri değişmeden statik havuzdan gelmeye devam eder.
- **`src/data/dailyContent.ts`**: mevcut 4 kayda, kullanıcı tarafından onaylanan 6 yeni kayıt eklenir (toplam 10) — hadis/dua alanları için, ayet alanları ise API başarısız olduğunda fallback olarak kullanılır.

## Hata Yönetimi

- UmmahAPI'ye ulaşılamazsa → backend `/api/daily-verse` 502 döner, frontend statik `content.verse`/`content.verseRef`'e sessizce düşer (kullanıcıya hata gösterilmez, "hadis"/"dua" sekmeleri zaten hep çalışır).
- Backend restart olursa → cache sıfırlanır, bir sonraki istek yeniden UmmahAPI'ye gider (kabul edilebilir, günde birkaç kez restart olması beklenmiyor).

## Test Yaklaşımı

- `server/dailyVerse.test.ts`: `node:test` ile, enjekte edilmiş sahte `fetchImpl` ve `now` kullanılarak — aynı gün içinde ikinci çağrının `fetchImpl`'i tekrar çağırmadığını (cache), farklı günde tekrar çağırdığını, ve sure numarası → Türkçe isim eşlemesinin doğruluğunu doğrular.
- `server/app.test.ts`'e `GET /api/daily-verse` için 200/502 senaryoları eklenir (mevcut `withServer` DI deseniyle).
- Frontend fetch mantığı (`DailyInspirationCard.tsx`) tarayıcı API'sine bağımlı olduğu için otomatik test yok, manuel doğrulanır.
