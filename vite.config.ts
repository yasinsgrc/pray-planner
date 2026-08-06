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
  'VITE_PRIVACY_LOG_RETENTION_DAYS',
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

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    define: {
      __APP_VERSION__: JSON.stringify(packageVersion),
    },
    plugins: [react(), tailwindcss(), warnMissingPrivacyEnv(env)],
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
