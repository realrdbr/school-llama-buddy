import { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await Network.getStatus();
        setIsOnline(status.connected);
        setConnectionType(status.connectionType);
      } catch (error) {
        // Fallback for web
        setIsOnline(navigator.onLine);
        setConnectionType('unknown');
      }
    };

    // Initial check
    checkStatus();

    // Listen for network changes (Capacitor)
    let networkListener: any;
    Network.addListener('networkStatusChange', (status) => {
      setIsOnline(status.connected);
      setConnectionType(status.connectionType);
    }).then(listener => {
      networkListener = listener;
    });

    // Fallback for web
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (networkListener) {
        networkListener.remove();
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, connectionType };
};