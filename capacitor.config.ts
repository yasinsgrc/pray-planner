import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.app.vakit',
  appName: 'Vakit',
  webDir: 'dist',
  plugins: {
    // @capacitor-community/safe-area v8: Capacitor 8'in kendi SystemBars
    // inset işlemesi kapatılmalı, yoksa eklentinin inset'leriyle çakışır.
    SystemBars: {
      insetsHandling: 'disable'
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_vakit',
      iconColor: '#E5B757'
    }
  }
};

export default config;
