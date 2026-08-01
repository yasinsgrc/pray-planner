# Gerçek Ezan Sesi + İlahi Sesleri — Tasarım

## Amaç

Bildirim/önizleme sesleri şu an tamamen sentetik (Web Audio ton üretimi). Bu tasarım gerçek bir ezan kaydı ekler ve kullanıcının vakit başına 6 ses seçeneği arasından seçim yapabilmesini sağlar: Ezan (gerçek kayıt), İlahi 1-3 (sentezlenmiş, ayırt edilebilir melodiler), Tını (mevcut basit ton), Sessiz.

## Ses Kaynağı Araştırması

- **Ezan:** Wikimedia Commons, `The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3`, yükleyen "own work" (kendi kaydı) olarak beyan etmiş, CC BY-SA 4.0. İndirilebilirliği ve dosya boyutu (1,448,294 bayt, 1:27 dk) doğrulandı. Freesound'daki bir "CC0" alternatif YouTube'dan alınmış olduğu için (lisans meşruiyeti şüpheli) kullanılmadı.
- **İlahi:** Serbest/uygun lisanslı gerçek bir kayıt bulunamadı (NoCopyrightNasheeds ücretli lisans istiyor, Pixabay canlı doğrulanamadı, Wikimedia'da özel bir koleksiyon yok) — kullanıcı onayıyla sentezlenmiş 3 melodi ile ilerleniyor.

## Mimari

- **`public/sounds/ezan.mp3`**: doğrulanmış URL'den indirilen gerçek dosya.
- **`src/utils/audio.ts`**: `playEzanAudio()` (gerçek dosyayı `<audio>` ile çalar, hata durumunda sessizce loglar), `playIlahiSample(1|2|3)` (3 farklı, ayırt edilebilir sentezlenmiş nota dizisi), `playSoundForMode(mode: SoundMode)` (merkezi yönlendirici). Eski sentetik `playEzanSample()` kaldırılır (artık kullanılmıyor, gerçek dosyayla değiştirildi).
- **`src/types.ts`**: `SoundMode` genişler: `'ezan' | 'tini' | 'ilahi1' | 'ilahi2' | 'ilahi3' | 'sessiz'`. Backend bunu opak string olarak sakladığı için hiç etkilenmez.
- **`src/components/SpiritualSettings.tsx`**: vakit başına 3'lü buton grubu, 6 seçeneği barındıran bir `<select>`'e dönüşür (mevcut "Hesaplama Yöntemi" deseniyle aynı); değişince hem ayar güncellenir hem önizleme çalar (`playSoundForMode`). Ezan için Wikimedia atıf notu eklenir.
- **`src/App.tsx`**: aktif vakit değiştiğinde (uygulama açıkken), seçili sesi "sessiz" değilse bir kez otomatik çalan bir `useEffect` eklenir (önceki aktif vakit bir `useRef`'te tutulur, ilk mount'ta çalmaz).
- **`src/components/DailyFlowList.tsx`**: vakit satırındaki ses göstergesi ikonuna `ilahi1/2/3` durumları da eklenir (aksi halde bu modlarda hiçbir gösterge görünmezdi).

## Kapsam Dışı

Gerçek ilahi kaydı (uygun kaynak bulunamadı, kullanıcı onayıyla sentezlenmiş sese düşüldü); Play Store için native bildirim sesi desteği (backend push bildirimi hâlâ OS kontrollü, önceki özellikte belirlendiği gibi).

## Test Yaklaşımı

Bu değişiklik tamamen tarayıcı ses API'lerine ve statik bir binary asset'e bağımlı — otomatik test yok (mevcut projede `audio.ts` hiç test edilmemişti, bu tutarlı). Manuel doğrulama: `curl` ile dosyanın Vite tarafından servis edildiğini, `tsc --noEmit`'in temiz kaldığını doğrulamak yeterli.
