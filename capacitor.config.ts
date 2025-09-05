import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.9ae774e0b72a4cd5a9988909b3683cb8',
  appName: 'school-llama-buddy',
  webDir: 'dist',
  server: {
    url: 'https://9ae774e0-b72a-4cd5-a998-8909b3683cb8.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP"
    }
  }
};

export default config;