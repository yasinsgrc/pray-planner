import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vakit',
  appName: 'Vakit',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_vakit',
      iconColor: '#E5B757'
    }
  }
};

export default config;
