# Tasarım Yenileme (Faz 1) — Tasarım

## Amaç

VAKİT'in mevcut sıcak altın (#D6A84D) + krem kimliğini korurken, `C:\Users\Yasin\Desktop\animated_websites` altındaki 6 referans projeden (dental-health, jack-3d-creator, lithos-hero, lumora, organic-visions, lithos-dist) çıkarılan tekrar eden kaliteli desenleri uygulayarak görsel yürütmeyi elle tutulur şekilde yükseltmek.

## Araştırma Bulguları (Explore agent raporu, özet)

- **Materyal:** "Liquid glass" reçetesi (yarı saydam arka plan + `backdrop-blur` + ince kenarlık) — lumora ve organic-visions'da birebir tekrarlanan, doğrulanmış bir bileşen.
- **Renk hiyerarşisi:** Tek bir ton, farklı opaklıklarla (organic-visions: `text-white/70,/80,/90`) — ayrı gri tonları yerine.
- **Tipografi:** Serif başlık + sans UI eşleşmesi (lithos-hero, organic-visions) — VAKİT'in zaten sahip olduğu yönü doğruluyor. Akıcı boyutlandırma için `clamp()`.
- **Hareket:** Görünüme-tetiklenen (`IntersectionObserver`/`whileInView`) staggered fade-up, expo-out ease (`cubic-bezier(0.16,1,0.3,1)`), ~80-120ms kademe — 3 projede tekrarlanan tek desen. Önemli öğeler için "blur-up" giriş (`filter: blur(12px)→0` + fade + translateY).
- **Mikro-etkileşim:** `hover:scale-[1.03] active:scale-95` tüm dokunulabilir öğelerde tutarlı.
- **Şekil dili:** Etkileşimli öğeler (butonlar) `rounded-full`, içerik kartları `rounded-2xl/3xl`.

## Mimari (Faz 1 kapsamı)

- **`src/index.css`**: `.glass-panel` utility'si eklenir (yalnızca `background: color-mix(...)` + `backdrop-filter: blur(16px)` — kasıtlı olarak border/box-shadow içermez, aksi halde Tailwind'in `border-l-4` gibi utility'leriyle CSS specificity çakışması olurdu, her kullanım yeri kendi border'ını Tailwind class'ıyla ekler). `blurUpIn` keyframe'i + `.animate-blur-up` + `prefers-reduced-motion` guard'ı eklenir.
- **`src/components/FadeIn.tsx`** (yeni): `motion/react` (proje zaten bağımlı) etrafında ince bir sarmalayıcı — `whileInView` tabanlı, `once: true`, expo-out ease, tek bir yerde tanımlı tekrar kullanılabilir giriş animasyonu.
- **`src/components/MainCountdownRing.tsx`**: halka konteynerine `.animate-blur-up`; geri sayım rakamlarına `clamp()` akıcı boyut; "Sıradaki Vakit" kartına `.glass-panel` + kenarlık geri eklenir; alt butonlara mikro-etkileşim.
- **`src/components/DailyFlowList.tsx`**: aktif vakit kartına `.glass-panel` + orijinal 4px altın sol kenarlık + diğer kenarlıklar (mevcut motion.div stagger animasyonu korunur, `layout` prop'u bozulmasın diye yeniden sarmalanmaz).
- **`src/components/SpiritualSettings.tsx`**: "Bildirimlere İzin Ver" butonu `rounded-full` + mikro-etkileşime geçer; erken uyarı ve gece modu buton gruplarına mikro-etkileşim eklenir.
- **`src/components/Navbar.tsx`**: alt bar `.glass-panel`'e geçer (kenarlık korunur); sekme butonlarına mikro-etkileşim.

## Kapsam Dışı (Faz 2 adayları)

Ayarlar ekranındaki her kartın tek tek `<FadeIn>` ile sarmalanması (yüksek işçilik/düşük risk-getiri, bu geçişte atlandı); ana ekranın bento-grid'e dönüştürülmesi; sayısal "count-up" splash ekranı; manyetik hover; günün ayeti kartının glass treatment'ı. Bunlar ayrı, daha küçük geçişlerde ele alınabilir.

## Doğrulama

Bu tamamen görsel/CSS bir değişiklik olduğu için `tsc --noEmit` ve `npm run build`'in temiz geçmesi doğrulandı (her ikisi de gerçek repo üzerinde çalıştırıldı). **Önemli kısıt:** bu ortamda tarayıcı/ekran görüntüsü alma aracı yok, yani görsel sonucu bizzat göremedim — kullanıcının `npm run dev` ile açıp gözle kontrol etmesi gerekiyor.
