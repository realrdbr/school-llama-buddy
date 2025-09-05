import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css';

// Register service worker only in production to avoid Vite dev/HMR conflicts
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // @ts-ignore - Vite provides import.meta.env.PROD
  if (import.meta && import.meta.env && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
}

createRoot(document.getElementById("root")!).render(
  <App />
);
