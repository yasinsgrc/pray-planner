# Konum Arama (Gerçek Geocoding) — Tasarım

## Amaç

`LocationModal` şu an yalnızca 16 sabit şehir arasında filtreleme yapıyor; serbest metin arama gerçek sonuç döndürmüyor, GPS ile alınan konum da gerçek bir yer adına çözülmüyor (sabit "Mevcut Konum / GPS Tespiti" yazıyor). Bu tasarım, OpenStreetMap Nominatim API'sini mevcut Express backend üzerinden proxy'leyerek gerçek şehir/ilçe arama ve GPS→yer adı çözümü ekler.

Kapsam dışı: Türkiye il/ilçe verisinin yerel olarak gömülmesi (kullanıcı Nominatim-only'yi tercih etti); PWA/paketleme, tasarım cilası — ayrı alt projeler.

## Mimari

```
[LocationModal.tsx]
    │ 400ms debounce, min 2 karakter
    ▼
GET /api/geocode?q=...          GET /api/reverse-geocode?lat=&lng=
    │                                    │
    ▼                                    ▼
[server/geocoding.ts] ──► Nominatim (nominatim.openstreetmap.org)
    │ (User-Agent: "VAKIT-Namaz-App/1.0")
    ▼
mapNominatimResultToLocationItem() [saf fonksiyon]
    ▼
LocationItem[] / LocationItem
```

- **`server/geocoding.ts`**: `searchLocations(query: string): Promise<LocationItem[]>` ve `reverseGeocode(lat: number, lng: number): Promise<LocationItem | null>` — ikisi de Nominatim'e uygun `User-Agent` başlığıyla `fetch` yapar, ham yanıtı `mapNominatimResultToLocationItem()` (saf fonksiyon) ile mevcut `LocationItem` şekline (`id, cityName, districtName, country, lat, lng`) çevirir: `cityName` için `address.city ?? address.town ?? address.county ?? display_name.split(',')[0]`, `districtName` için `address.suburb ?? address.state_district ?? address.city ?? ''`, `country` için `address.country ?? ''` fallback zinciri kullanılır.
- **`server/app.ts`**'e iki yeni route eklenir: `GET /api/geocode?q=` (boş/çok kısa `q` → 400) ve `GET /api/reverse-geocode?lat=&lng=` (geçersiz sayı → 400).
- **`src/components/LocationModal.tsx`**: arama kutusu değiştikçe (400ms debounce, min 2 karakter) `/api/geocode`'a istek atar, sonuçlar mevcut sabit listenin *üstünde* ayrı bir "Arama Sonuçları" bölümü olarak gösterilir; kutu boşsa yalnızca mevcut sabit liste görünür (davranış değişmez). GPS butonu, koordinat alındıktan sonra `/api/reverse-geocode`'u çağırıp dönen `LocationItem`'ı kullanır; başarısız olursa mevcut sabit "Mevcut Konum / GPS Tespiti" davranışına düşer (regresyon yok).

## Hata Yönetimi

- Nominatim isteği başarısız/timeout → "Arama başarısız, tekrar deneyin" mesajı, sabit liste her zaman görünür kalır (asla boş ekran).
- Sonuç bulunamadı (boş dizi) → ayrı "Sonuç bulunamadı" mesajı.
- `reverse-geocode` başarısız → GPS akışı mevcut davranışa (sabit "Mevcut Konum" etiketi) sessizce düşer, kullanıcıya hata gösterilmez (konum yine de doğru kaydedilir, sadece isim güzel görünmez).
- Backend çalışmıyorsa → aynı "Arama başarısız" mesajı (push bildirimi özelliğindeki "sunucuya ulaşılamadı" deseniyle tutarlı).

## Test Yaklaşımı

- `mapNominatimResultToLocationItem()` saf fonksiyonu `node:test` ile test edilir: eksik `city` alanında `town`/`county` fallback'i, eksik adres bilgisinde boş string'e düşme, `display_name`'den şehir adı çıkarma.
- `searchLocations`/`reverseGeocode`'un gerçek Nominatim çağrıları otomatik test edilmez (dış ağ bağımlılığı) — manuel doğrulanır.
- `/api/geocode` ve `/api/reverse-geocode` route'ları, mevcut `app.test.ts` desenine uygun şekilde (gerçek `app.listen(0)` + `fetch`) sahte bir `searchLocations`/`reverseGeocode` enjekte edilerek test edilir (backend'in kendisi network çağrısı yapmadan route mantığı doğrulanır).

## Yerel Geliştirme Akışı

Değişiklik yok — `npm run dev:all` zaten hem frontend hem backend'i başlatıyor, `/api/*` proxy'si zaten kurulu.
