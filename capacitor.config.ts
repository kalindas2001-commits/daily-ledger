import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.p51e3df563f8544a19a54f0253ef54f26',
  appName: 'CungaCash',
  webDir: 'dist',
  // Opt-in local Android development only; release builds use bundled assets.
  ...(process.env.CUNGA_NATIVE_LIVE_PREVIEW === '1' ? {
    server: { url: 'https://51e3df56-3f85-44a1-9a54-f0253ef54f26.lovableproject.com?forceHideBadge=true', cleartext: true },
  } : {}),
};

export default config;
