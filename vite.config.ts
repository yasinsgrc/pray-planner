import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import {readFileSync} from 'fs';

// Geri bildirim mailto'suna otomatik eklenen "uygulama sürümü" tanı
// bilgisi (design-refresh-v3 Faz 20 madde 5) buradan gelir — package.json
// tek kaynak, elle senkronize edilen ikinci bir sürüm sabiti yok.
const packageVersion = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).version as string;

const REQUIRED_PRIVACY_ENV_KEYS = [
  'VITE_PRIVACY_ENTITY_NAME',
  'VITE_PRIVACY_ADDRESS',
  'VITE_PRIVACY_CONTACT_EMAIL',
  'VITE_PRIVACY_HOSTING_PROVIDER',
] as const;

// Bu alanlar Netlify'ın ortam değişkenleri ekranında ilk dağıtımdan önce
// tanımlanmazsa, canlı sitedeki Gizlilik Politikası sayfasında görünür
// kırmızı yer tutucular yayına çıkar (privacyConfig.ts, PrivacyPolicyModal.tsx).
// Yalnızca prod build'de uyarır — yerel geliştirmede bu alanların boş olması
// normaldir ve engellenmemeli (design-refresh-v3 Faz 9 F4).
function warnMissingPrivacyEnv(env: Record<string, string>): Plugin {
  return {
    name: 'warn-missing-privacy-env',
    apply: 'build',
    buildStart() {
      const missing = REQUIRED_PRIVACY_ENV_KEYS.filter((key) => !env[key]);
      if (missing.length > 0) {
        this.warn(
          `Gizlilik politikası alanları tanımlanmadı: ${missing.join(', ')}. Netlify'ın ortam ` +
            `değişkenleri ekranında ilk dağıtımdan önce tanımlanmazsa, canlı sitedeki gizlilik ` +
            `sayfasında görünür yer tutucular yayına çıkar.`
        );
      }
    },
  };
}

// Native (Capacitor) origin is `https://localhost` — a relative /api/*
// path silently resolves to a request against that same fake local origin,
// which nothing answers (design-refresh-v3 Faz 23 Commit 1). Web builds
// are unaffected: the relative-path fallback is exactly what single-origin
// Node hosting needs, and VAKIT_TARGET is only ever set by android:sync.
// Unlike warnMissingPrivacyEnv (a warning — a placeholder text is merely
// ugly), a missing base URL here means every /api/* and /health call fails
// outright, so this must fail the build, not just warn.
function requireApiBaseUrlForNativeBuild(env: Record<string, string>): Plugin {
  return {
    name: 'require-api-base-url-for-native-build',
    apply: 'build',
    buildStart() {
      if (process.env.VAKIT_TARGET === 'native' && !env.VITE_API_BASE_URL) {
        this.error(
          'VAKIT_TARGET=native ile build alınıyor ama VITE_API_BASE_URL tanımlı değil — native origin ' +
            "https://localhost olduğundan göreli /api/* ve /health çağrıları sessizce başarısız olur."
        );
      }
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    define: {
      __APP_VERSION__: JSON.stringify(packageVersion),
    },
    plugins: [react(), tailwindcss(), warnMissingPrivacyEnv(env), requireApiBaseUrlForNativeBuild(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: `http://localhost:${process.env.SERVER_PORT ?? '8787'}`,
          changeOrigin: true,
        },
      },
    },
  };
});
