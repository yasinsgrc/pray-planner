# Dağıtım — ortam değişkenleri

## Netlify (web build)

Aşağıdaki dört değişken, Gizlilik Politikası ekranındaki (Ayarlar > Hakkında > Gizlilik)
veri sorumlusu kimliğini doldurur (bkz. `src/utils/privacyConfig.ts`,
`src/components/PrivacyPolicyModal.tsx`). Netlify'ın ortam değişkenleri
ekranında tanımlanmalıdır:

```
VITE_PRIVACY_ENTITY_NAME     = VAKİT
VITE_PRIVACY_ADDRESS         = Darıca/Kocaeli
VITE_PRIVACY_CONTACT_EMAIL   = yyasinsgrc@gmail.com
VITE_PRIVACY_HOSTING_PROVIDER = Netlify (uygulama dosyaları) ve Railway (bildirim sunucusu, Avrupa Birliği)
```

Beşinci bir değişken olan `VITE_PRIVACY_LOG_RETENTION_DAYS` daha önce
vardı; Faz 24 Commit 2'de kaldırıldı — politika artık sabit bir gün
sayısı taahhüt etmiyor (bkz. `src/data/privacy.ts`, "7. Saklama
Süresi" bölümü).

**Bu değişkenler build zamanında okunur** (Vite, `VITE_` önekli
değişkenleri derleme sırasında koda gömer). Netlify'da değeri
değiştirmek, **yeni bir dağıtım tetiklenmeden** canlı siteye yansımaz
— ortam değişkenini güncelledikten sonra "Trigger deploy" (veya yeni
bir commit push) gerekir.

Tanımsız bırakılan herhangi bir alan, build'i **durdurmaz** (yalnızca
`npm run build` sırasında bir uyarı basar, bkz. `vite.config.ts`'teki
`warnMissingPrivacyEnv`), ama canlı gizlilik sayfasında o alan için
gözle görülür kırmızı bir `[TANIMLANMADI]` uyarısı kalır.

## Railway (bildirim sunucusu)

`server/` klasörünün ihtiyaç duyduğu ortam değişkenleri için
`.env.example`'a bakın (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT`, `DATABASE_URL`, `CORS_ALLOWED_ORIGIN`).

## Native (Android) build — `VITE_API_BASE_URL` zorunlu

`npm run android:sync`, `VAKIT_TARGET=native` ile bir build tetikler.
Native ortamda origin `https://localhost`'tur; `VITE_API_BASE_URL`
tanımsızsa göreli `/api/*` ve `/health` çağrıları sessizce başarısız
olur (bkz. `src/utils/apiBaseUrl.ts`, design-refresh-v3 Faz 23 Commit
1). Bu yüzden `vite.config.ts`'teki `requireApiBaseUrlForNativeBuild`
eklentisi, `VAKIT_TARGET=native` iken `VITE_API_BASE_URL` tanımlı
değilse build'i **durdurur** (yalnızca uyarmaz).

`android:sync` çalıştırmadan önce `VITE_API_BASE_URL` yerel `.env`
dosyanızda tanımlı olmalı — örnek:

```
VITE_API_BASE_URL="https://api.vakit.yasinsigirci.com.tr"
```
