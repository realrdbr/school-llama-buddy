import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Upload, Mic, Play, Pause, Trash2, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const AudioAnnouncements = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // TTS Form state
  const [ttsForm, setTtsForm] = useState({
    title: '',
    description: '',
    text: '',
    voice_id: 'alloy',
    schedule_date: ''
  });
  
  // Upload Form state
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    schedule_date: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!profile || profile.permission_lvl < 10) {
      navigate('/');
      return;
    }
    loadAnnouncements();
  }, [profile, navigate]);

  const loadAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('audio_announcements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Durchsagen konnten nicht geladen werden",
        variant: "destructive"
      });
    }
  };

  const handleTTSSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ttsForm.title || !ttsForm.text) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('audio-tts', {
        body: ttsForm
      });
      
      if (error) throw error;
      
      toast({
        title: "Erfolg",
        description: "TTS-Durchsage wurde erstellt"
      });
      
      setTtsForm({
        title: '',
        description: '',
        text: '',
        voice_id: 'alloy',
        schedule_date: ''
      });
      
      loadAnnouncements();
    } catch (error) {
      toast({
        title: "Fehler",
        description: error.message || "TTS-Durchsage konnte nicht erstellt werden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.title || !selectedFile) return;
    
    setLoading(true);
    try {
      // Upload file to storage
      const fileName = `${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('audio-announcements')
        .upload(fileName, selectedFile);
      
      if (uploadError) throw uploadError;
      
      // Create announcement record
      const { error: insertError } = await supabase
        .from('audio_announcements')
        .insert({
          title: uploadForm.title,
          description: uploadForm.description,
          audio_file_path: fileName,
          is_tts: false,
          schedule_date: uploadForm.schedule_date || null,
          created_by: profile.id.toString(),
          is_active: true
        });
      
      if (insertError) throw insertError;
      
      toast({
        title: "Erfolg",
        description: "Audio-Durchsage wurde hochgeladen"
      });
      
      setUploadForm({
        title: '',
        description: '',
        schedule_date: ''
      });
      setSelectedFile(null);
      
      loadAnnouncements();
    } catch (error) {
      toast({
        title: "Fehler",
        description: error.message || "Audio-Durchsage konnte nicht hochgeladen werden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      const { error } = await supabase
        .from('audio_announcements')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Erfolg",
        description: "Durchsage wurde gelöscht"
      });
      
      loadAnnouncements();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Durchsage konnte nicht gelöscht werden",
        variant: "destructive"
      });
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('audio_announcements')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      loadAnnouncements();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Status konnte nicht geändert werden",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE');
  };

  if (!profile || profile.permission_lvl < 10) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Button>
        <h1 className="text-3xl font-bold">Audio-Durchsagen</h1>
      </div>

      <Tabs defaultValue="create" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Neue Durchsage</TabsTrigger>
          <TabsTrigger value="manage">Verwalten</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Text-zu-Sprache
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTTSSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="tts-title">Titel</Label>
                    <Input
                      id="tts-title"
                      value={ttsForm.title}
                      onChange={(e) => setTtsForm(prev => ({...prev, title: e.target.value}))}
                      placeholder="Titel der Durchsage"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="tts-description">Beschreibung (optional)</Label>
                    <Input
                      id="tts-description"
                      value={ttsForm.description}
                      onChange={(e) => setTtsForm(prev => ({...prev, description: e.target.value}))}
                      placeholder="Kurze Beschreibung"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="tts-text">Text</Label>
                    <Textarea
                      id="tts-text"
                      value={ttsForm.text}
                      onChange={(e) => setTtsForm(prev => ({...prev, text: e.target.value}))}
                      placeholder="Text für die Durchsage eingeben..."
                      className="min-h-32"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="tts-voice">Stimme</Label>
                    <Select 
                      value={ttsForm.voice_id} 
                      onValueChange={(value) => setTtsForm(prev => ({...prev, voice_id: value}))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alloy">Alloy</SelectItem>
                        <SelectItem value="echo">Echo</SelectItem>
                        <SelectItem value="fable">Fable</SelectItem>
                        <SelectItem value="onyx">Onyx</SelectItem>
                        <SelectItem value="nova">Nova</SelectItem>
                        <SelectItem value="shimmer">Shimmer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="tts-schedule">Zeitplan (optional)</Label>
                    <Input
                      id="tts-schedule"
                      type="datetime-local"
                      value={ttsForm.schedule_date}
                      onChange={(e) => setTtsForm(prev => ({...prev, schedule_date: e.target.value}))}
                    />
                  </div>
                  
                  <Button type="submit" disabled={loading} className="w-full">
                    TTS-Durchsage erstellen
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Audio-Datei hochladen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleFileUpload} className="space-y-4">
                  <div>
                    <Label htmlFor="upload-title">Titel</Label>
                    <Input
                      id="upload-title"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm(prev => ({...prev, title: e.target.value}))}
                      placeholder="Titel der Durchsage"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="upload-description">Beschreibung (optional)</Label>
                    <Input
                      id="upload-description"
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm(prev => ({...prev, description: e.target.value}))}
                      placeholder="Kurze Beschreibung"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="upload-file">Audio-Datei (.mp3, .wav)</Label>
                    <Input
                      id="upload-file"
                      type="file"
                      accept=".mp3,.wav"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="upload-schedule">Zeitplan (optional)</Label>
                    <Input
                      id="upload-schedule"
                      type="datetime-local"
                      value={uploadForm.schedule_date}
                      onChange={(e) => setUploadForm(prev => ({...prev, schedule_date: e.target.value}))}
                    />
                  </div>
                  
                  <Button type="submit" disabled={loading} className="w-full">
                    Audio hochladen
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="manage">
          <Card>
            <CardHeader>
              <CardTitle>Durchsagen verwalten</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {announcements.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Keine Durchsagen vorhanden
                  </p>
                ) : (
                  announcements.map((announcement: any) => (
                    <div key={announcement.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h3 className="font-semibold">{announcement.title}</h3>
                          {announcement.description && (
                            <p className="text-sm text-muted-foreground">
                              {announcement.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Erstellt: {formatDate(announcement.created_at)}</span>
                            {announcement.schedule_date && (
                              <>
                                <Separator orientation="vertical" className="h-3" />
                                <Calendar className="h-3 w-3" />
                                <span>Geplant: {formatDate(announcement.schedule_date)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={announcement.is_tts ? "secondary" : "outline"}>
                            {announcement.is_tts ? "TTS" : "Audio"}
                          </Badge>
                          <Badge variant={announcement.is_active ? "default" : "secondary"}>
                            {announcement.is_active ? "Aktiv" : "Inaktiv"}
                          </Badge>
                        </div>
                      </div>
                      
                      {announcement.is_tts && announcement.tts_text && (
                        <div className="bg-muted p-3 rounded text-sm">
                          <strong>Text:</strong> {announcement.tts_text}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={announcement.is_active ? "secondary" : "default"}
                            onClick={() => toggleActive(announcement.id, announcement.is_active)}
                          >
                            {announcement.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            {announcement.is_active ? "Deaktivieren" : "Aktivieren"}
                          </Button>
                        </div>
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteAnnouncement(announcement.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Löschen
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AudioAnnouncements;