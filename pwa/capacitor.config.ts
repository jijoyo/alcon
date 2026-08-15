import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alcon.app',
  appName: 'Alcon',
  webDir: 'dist',
  server: {
    url: 'http://100.102.63.30:3004',
    cleartext: true,
    androidScheme: 'http',
  },
};

export default config;
