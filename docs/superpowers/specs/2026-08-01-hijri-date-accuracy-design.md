# Hicri Tarih Doğruluğu — Tasarım

## Amaç

`src/utils/hijri.ts`'teki hicri tarih hesaplaması, ev yapımı bir tablo algoritmasıdır ve Diyanet'in resmi takviminden önemli ölçüde sapabilir. Bu tasarım, `hijri-converter` (Ümmü'l-Kura resmi takvim verisine dayanan, bağımlılıksız, MIT lisanslı bir kütüphane) ile hesaplamayı değiştirir ve kullanıcıya bu hesaplamanın kesinlik sınırını açıkça bildiren bir bilgi kartı ekler.

Araştırma notu: Hiçbir algoritmik kütüphane Diyanet'in resmi takvimini birebir garanti etmez (Diyanet kendi komisyon kararlarına dayanır). `hijri-converter`, gerçek yayınlanmış Ümmü'l-Kura takvim tablosunu kullandığı için mevcut yaklaşık algoritmadan çok daha güvenilirdir, ama yine de bazı aylarda Diyanet'ten ±1 gün farklı olabilir — bu yüzden bilgilendirme kartı gereklidir (kesinlik sınırını gizlemek yerine açıkça söylemek).

## Mimari

- **Bağımlılık:** `hijri-converter@^1.1.1` (deps: none, MIT). TypeScript tip tanımı gelmediği için `src/utils/hijri-converter.d.ts` içinde küçük bir ambient module declaration yazılır.
- **`src/utils/hijri.ts`**: `getHijriDate(date?: Date): HijriDateInfo` imzası ve `HijriDateInfo` şekli (mevcut `src/types.ts`'teki tip) **değişmez** — sadece iç hesaplama `toHijri(gy, gm, gd)` çağrısına döner. Hiçbir çağıran kod (`App.tsx`, `Header.tsx`) değişmez.
- **`src/components/SpiritualSettings.tsx`**: "Hesaplama Yöntemi" kartının hemen altına, aynı stilde yeni bir "Hicri Tarih Hakkında" bilgi kartı eklenir (kullanıcı onayladığı yer).

## Test Yaklaşımı

`src/utils/hijri.test.ts`: `getHijriDate()` bilinen iki gerçek tarih için (`2025-06-26` → 1 Muharrem 1447, `2026-08-01` → 18 Safer 1448) doğru sonucu döndüğünü doğrular — gerçek `hijri-converter` kütüphanesiyle (mock'lanmadan), çünkü deterministik saf bir dönüşüm. Bu iki tarih zaten yerel olarak `hijri-converter`'ın kendisiyle doğrulandı.

## Kapsam Dışı

Diyanet'in resmi takvimiyle %100 birebir eşleşme garantisi — algoritmik olarak mümkün değil, bu yüzden bilgi kartı çözüm.
