import React, { useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Palette } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ThemeSettings = () => {
  const { currentTheme, userThemes, presets, setTheme, createTheme, updateTheme, deleteTheme } = useTheme();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<any>(null);
  const [newThemeName, setNewThemeName] = useState('');
  const [customColors, setCustomColors] = useState({
    background: '0 0% 100%',
    foreground: '222.2 84% 4.9%',
    primary: '222.2 47.4% 11.2%',
    'primary-foreground': '210 40% 98%',
    secondary: '210 40% 96.1%',
    'secondary-foreground': '222.2 47.4% 11.2%',
    accent: '210 40% 96.1%',
    'accent-foreground': '222.2 47.4% 11.2%',
    muted: '210 40% 96.1%',
    'muted-foreground': '215.4 16.3% 46.9%',
    border: '214.3 31.8% 91.4%',
    card: '0 0% 100%',
    'card-foreground': '222.2 84% 4.9%'
  });

  const handlePresetSelect = async (preset: any) => {
    await setTheme(preset);
    toast({
      title: "Theme geändert",
      description: `${preset.name} wurde angewendet.`,
    });
  };

  const handleCreateTheme = async () => {
    if (!newThemeName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Namen für das Theme ein.",
        variant: "destructive",
      });
      return;
    }

    await createTheme(newThemeName, customColors);
    toast({
      title: "Theme erstellt",
      description: `${newThemeName} wurde erstellt und angewendet.`,
    });
    setIsCreateDialogOpen(false);
    setNewThemeName('');
  };

  const handleEditTheme = (theme: any) => {
    setEditingTheme(theme);
    setCustomColors(theme.colors);
    setIsEditDialogOpen(true);
  };

  const handleUpdateTheme = async () => {
    if (!editingTheme) return;

    await updateTheme(editingTheme.id, customColors);
    toast({
      title: "Theme aktualisiert",
      description: `${editingTheme.name} wurde aktualisiert.`,
    });
    setIsEditDialogOpen(false);
    setEditingTheme(null);
  };

  const handleDeleteTheme = async (themeId: string, themeName: string) => {
    await deleteTheme(themeId);
    toast({
      title: "Theme gelöscht",
      description: `${themeName} wurde gelöscht.`,
    });
  };

  const colorInputs = [
    { key: 'background', label: 'Hintergrund', description: 'Haupthintergrundfarbe' },
    { key: 'foreground', label: 'Schrift', description: 'Haupttextfarbe' },
    { key: 'primary', label: 'Primär', description: 'Hauptakzentfarbe' },
    { key: 'primary-foreground', label: 'Primär Schrift', description: 'Text auf primärer Farbe' },
    { key: 'secondary', label: 'Sekundär', description: 'Sekundäre Farbe' },
    { key: 'secondary-foreground', label: 'Sekundär Schrift', description: 'Text auf sekundärer Farbe' },
    { key: 'accent', label: 'Akzent', description: 'Akzentfarbe für Highlights' },
    { key: 'accent-foreground', label: 'Akzent Schrift', description: 'Text auf Akzentfarbe' },
    { key: 'muted', label: 'Gedämpft', description: 'Gedämpfte Hintergrundfarbe' },
    { key: 'muted-foreground', label: 'Gedämpft Schrift', description: 'Gedämpfte Textfarbe' },
    { key: 'border', label: 'Rahmen', description: 'Farbe für Rahmen und Linien' },
    { key: 'card', label: 'Karte', description: 'Hintergrund für Karten' },
    { key: 'card-foreground', label: 'Karte Schrift', description: 'Text auf Karten' }
  ];

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Theme-Einstellungen</h1>
        <p className="text-muted-foreground">
          Passen Sie das Aussehen der Anwendung nach Ihren Wünschen an
        </p>
      </div>

      <Tabs defaultValue="presets" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="presets">Vorlagen</TabsTrigger>
          <TabsTrigger value="custom">Eigene Themes</TabsTrigger>
          <TabsTrigger value="create">Neues Theme</TabsTrigger>
        </TabsList>

        <TabsContent value="presets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vordefinierte Themes</CardTitle>
              <CardDescription>
                Wählen Sie aus unseren vordefinierten Farbschemas
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {presets.map((preset) => (
                <Card 
                  key={preset.name} 
                  className={`cursor-pointer border-2 transition-colors ${
                    currentTheme?.name === preset.name 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => handlePresetSelect(preset)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">{preset.name}</h3>
                      {currentTheme?.name === preset.name && (
                        <Badge variant="default">Aktiv</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-1 h-8">
                      <div 
                        className="rounded" 
                        style={{ backgroundColor: `hsl(${preset.colors.background})` }}
                      />
                      <div 
                        className="rounded" 
                        style={{ backgroundColor: `hsl(${preset.colors.primary})` }}
                      />
                      <div 
                        className="rounded" 
                        style={{ backgroundColor: `hsl(${preset.colors.secondary})` }}
                      />
                      <div 
                        className="rounded" 
                        style={{ backgroundColor: `hsl(${preset.colors.accent})` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ihre eigenen Themes</CardTitle>
              <CardDescription>
                Verwalten Sie Ihre benutzerdefinierten Farbschemas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userThemes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Sie haben noch keine eigenen Themes erstellt.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {userThemes.map((theme) => (
                    <Card 
                      key={theme.id} 
                      className={`border-2 transition-colors ${
                        currentTheme?.id === theme.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium">{theme.name}</h3>
                          {currentTheme?.id === theme.id && (
                            <Badge variant="default">Aktiv</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-1 h-8 mb-3">
                          <div 
                            className="rounded" 
                            style={{ backgroundColor: `hsl(${theme.colors.background})` }}
                          />
                          <div 
                            className="rounded" 
                            style={{ backgroundColor: `hsl(${theme.colors.primary})` }}
                          />
                          <div 
                            className="rounded" 
                            style={{ backgroundColor: `hsl(${theme.colors.secondary})` }}
                          />
                          <div 
                            className="rounded" 
                            style={{ backgroundColor: `hsl(${theme.colors.accent})` }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setTheme(theme)}
                            className="flex-1"
                          >
                            Anwenden
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleEditTheme(theme)}
                          >
                            <Palette className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleDeleteTheme(theme.id!, theme.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Neues Theme erstellen</CardTitle>
              <CardDescription>
                Erstellen Sie Ihr eigenes Farbschema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="themeName">Theme-Name</Label>
                <Input
                  id="themeName"
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  placeholder="Mein Theme"
                  className="mt-1"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {colorInputs.map(({ key, label, description }) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      value={customColors[key as keyof typeof customColors]}
                      onChange={(e) => setCustomColors(prev => ({
                        ...prev,
                        [key]: e.target.value
                      }))}
                      placeholder="HSL Werte (z.B. 210 40% 98%)"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Button onClick={handleCreateTheme} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Theme erstellen
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Theme Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Theme bearbeiten: {editingTheme?.name}</DialogTitle>
            <DialogDescription>
              Passen Sie die Farben Ihres Themes an
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {colorInputs.map(({ key, label, description }) => (
              <div key={key} className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor={`edit-${key}`} className="text-right font-medium">
                  {label}
                </Label>
                <div className="col-span-3 space-y-1">
                  <Input
                    id={`edit-${key}`}
                    value={customColors[key as keyof typeof customColors]}
                    onChange={(e) => setCustomColors(prev => ({
                      ...prev,
                      [key]: e.target.value
                    }))}
                    placeholder="HSL Werte"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleUpdateTheme}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ThemeSettings;