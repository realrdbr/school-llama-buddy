import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, WifiOff } from 'lucide-react';

export const OfflineIndicator = () => {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <Alert className="mb-4 border-warning bg-warning/10">
      <WifiOff className="h-4 w-4" />
      <AlertDescription>
        Keine Internetverbindung. Offline-Daten werden angezeigt.
      </AlertDescription>
    </Alert>
  );
};