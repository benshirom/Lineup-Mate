import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lineupmate.app',
  appName: 'Lineup Mate',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    CapacitorUpdater: {
      autoUpdate: true,
      updateUrl: 'https://jcokguqwmdkkzdakyamo.supabase.co/functions/v1/app-update',
      appReadyTimeout: 10000,
    },
  },
};

export default config;
