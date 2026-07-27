import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alcon.app',
  appName: 'Alcon',
  webDir: 'dist',
  server: {
    url: 'http://100.102.63.30:5176',
    cleartext: true,
    androidScheme: 'http',
  },
};

export default config;
