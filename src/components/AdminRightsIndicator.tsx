import React from 'react';
import { useAdminRights } from '@/hooks/useAdminRights';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const AdminRightsIndicator: React.FC = () => {
  const { hasAdminRights, isCheckingRights, requestAdminRights } = useAdminRights();

  if (isCheckingRights) {
    return (
      <Card className="border-muted">
        <CardContent className="flex items-center gap-2 p-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Überprüfe Admin-Rechte...</span>
        </CardContent>
      </Card>
    );
  }

  if (hasAdminRights) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
        <CardContent className="flex items-center gap-2 p-4">
          <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm text-green-700 dark:text-green-300 font-medium">
            Admin-Rechte aktiv - Sie können Änderungen vornehmen
          </span>
        </CardContent>
      </Card>
    );
  }

  const handleRequestRights = async () => {
    const success = await requestAdminRights();
    if (success) {
      toast({
        title: "Admin-Rechte erhalten",
        description: "Sie können jetzt Änderungen vornehmen."
      });
    } else {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Admin-Rechte konnten nicht übernommen werden. Ein anderes Gerät hat möglicherweise bereits die Kontrolle."
      });
    }
  };

  return (
    <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          Nur-Lesen Modus
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
          Ein anderes Gerät hat derzeit die Admin-Rechte. Sie können Inhalte anzeigen, aber keine Änderungen vornehmen.
        </p>
        <Button 
          onClick={handleRequestRights}
          size="sm" 
          variant="outline"
          className="border-yellow-300 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-300 dark:hover:bg-yellow-900"
        >
          Admin-Rechte übernehmen
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminRightsIndicator;