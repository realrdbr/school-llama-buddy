import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Volume2, VolumeX, Mic, Upload, Play, Pause, RotateCcw, ArrowLeft, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OfflineTTS from '@/components/OfflineTTS';

interface AudioAnnouncement {
  id: string;
  title: string;
  description?: string;
  is_tts: boolean;
  tts_text?: string;
  voice_id?: string;
  audio_file_path?: string;
  duration_seconds?: number;
  schedule_date?: string;
  is_active: boolean;
  played_at?: string;
  created_at: string;
}

const AudioAnnouncements = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<AudioAnnouncement[]>([]);
  const [loading, setLoading] = useState(false);
  const [ttsForm, setTtsForm] = useState({
    title: '',
    description: '',
    text: '',
    voice_id: 'thorsten-medium',
    tts_type: 'piper', // 'piper' or 'browser'
    schedule_date: ''
  });

  const [audioForm, setAudioForm] = useState({
    title: '',
    description: '',
    audio_file: null as File | null,
    schedule_date: ''
  });

  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('audio_announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast({
        title: "Fehler",
        description: "Durchsagen konnten nicht geladen werden",
        variant: "destructive"
      });
    }
  };

  const handleTTSSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ttsForm.title || !ttsForm.text) {
      toast({
        title: "Fehler",
        description: "Titel und Text sind erforderlich",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    try {
      if (ttsForm.tts_type === 'browser') {
        // Use Browser TTS - create announcement record directly
        const { error: insertError } = await supabase
          .from('audio_announcements')
          .insert({
            title: ttsForm.title,
            description: ttsForm.description || `Browser TTS-Durchsage erstellt von ${profile?.username}`,
            is_tts: true,
            tts_text: ttsForm.text,
            voice_id: ttsForm.voice_id,
            schedule_date: ttsForm.schedule_date || null,
            is_active: true
          });

        if (insertError) throw insertError;

        toast({
          title: "Erfolg",
          description: "Browser TTS-Durchsage wurde erstellt"
        });
      } else {
        // Use PiperTTS via server
        const { data: ttsResult, error: ttsError } = await supabase.functions.invoke('native-tts', {
          body: {
            text: ttsForm.text,
            voice_id: ttsForm.voice_id,
            title: ttsForm.title,
            description: ttsForm.description || `PiperTTS-Durchsage erstellt von ${profile?.username}`,
            schedule_date: ttsForm.schedule_date,
            user_id: profile?.username || profile?.name,
            use_piper: true
          }
        });

        if (ttsError) {
          throw new Error(`TTS-Fehler: ${ttsError.message}`);
        }

        if (!ttsResult?.success) {
          throw new Error(ttsResult?.error || 'TTS-Generierung fehlgeschlagen');
        }

        // Immediately add the new announcement to state if returned
        if (ttsResult?.announcement) {
          setAnnouncements(prev => [ttsResult.announcement, ...prev]);
        }
        
        toast({
          title: "Erfolg",
          description: ttsResult.message || "TTS-Durchsage wurde erfolgreich erstellt"
        });
      }
      
      // Reset form
      setTtsForm({
        title: '',
        description: '',
        text: '',
        voice_id: 'thorsten-medium',
        tts_type: 'piper',
        schedule_date: ''
      });
      
      // Refresh announcements
      fetchAnnouncements();
    } catch (error: any) {
      console.error('TTS Submit Error:', error);
      toast({
        title: "Fehler",
        description: error.message || "TTS-Durchsage konnte nicht erstellt werden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAudioUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioForm.title || !audioForm.audio_file) return;

    setLoading(true);
    try {
      // Upload audio file to Supabase Storage (use audio-files bucket for consistency)
      const fileName = `${Date.now()}_${audioForm.audio_file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, audioForm.audio_file);

      if (uploadError) throw uploadError;

      // Create announcement record
      const { error: insertError } = await supabase
        .from('audio_announcements')
        .insert({
          title: audioForm.title,
          description: audioForm.description,
          is_tts: false,
          audio_file_path: fileName,
          schedule_date: audioForm.schedule_date || null,
          is_active: true
          // created_by is now nullable, so we don't need to set it
        });

      if (insertError) throw insertError;

      toast({
        title: "Erfolg",
        description: "Audio-Durchsage wurde hochgeladen"
      });

      // Reset form
      setAudioForm({
        title: '',
        description: '',
        audio_file: null,
        schedule_date: ''
      });

      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Audio konnte nicht hochgeladen werden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const playAnnouncement = async (announcement: AudioAnnouncement) => {
    try {
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      let audioUrl = '';

      // Prefer stored audio file if available (server-generated PiperTTS or uploaded files)
      if (announcement.audio_file_path) {
        const bucket = announcement.is_tts ? 'audio-announcements' : 'audio-files';
        
        // Normalize path - remove bucket prefix if accidentally included
        const normalizedPath = announcement.audio_file_path.replace(/^audio-announcements\//, '');
        
        console.log(`🎵 Play from file: ${bucket}/${normalizedPath}`, announcement);
        
        const { data } = supabase.storage
          .from(bucket)
          .getPublicUrl(normalizedPath);
        audioUrl = data.publicUrl;
        
        console.log(`🎵 Audio URL: ${audioUrl}`);
      } else if (announcement.is_tts && announcement.tts_text && !announcement.audio_file_path) {
        // Fallback: Use the Web Speech API for TTS when no audio file exists
        console.log(`🗣️ Fallback to Browser TTS for: ${announcement.title}`, announcement);
        
        if ('speechSynthesis' in window) {
          speechSynthesis.cancel();
          
          const utterance = new SpeechSynthesisUtterance(announcement.tts_text);
          
          // Try to find a German voice
          const voices = speechSynthesis.getVoices();
          const germanVoice = voices.find(voice => 
            voice.lang.includes('de') || voice.name.includes('German')
          );
          
          if (germanVoice) {
            utterance.voice = germanVoice;
          }
          
          utterance.lang = 'de-DE';
          utterance.rate = 0.9;
          utterance.pitch = 1;
          utterance.volume = 0.8;
          
          utterance.onstart = () => {
            setPlayingId(announcement.id);
          };
          
          utterance.onend = () => {
            setPlayingId(null);
          };
          
          utterance.onerror = () => {
            setPlayingId(null);
            toast({
              title: "TTS Fehler",
              description: "Fehler bei der Sprachwiedergabe",
              variant: "destructive"
            });
          };
          
          speechSynthesis.speak(utterance);
          return;
        } else {
          throw new Error('Web Speech API nicht unterstützt');
        }
      } else {
        console.log(`❌ No playback method available for: ${announcement.title}`, announcement);
        throw new Error('Keine Audioquelle verfügbar');
      }

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.onplay = () => setPlayingId(announcement.id);
        audio.onended = () => setPlayingId(null);
        audio.onerror = () => {
          setPlayingId(null);
          console.error(`❌ Audio playback failed for: ${audioUrl}`);
          toast({
            title: "Wiedergabe-Fehler",
            description: "Audio konnte nicht abgespielt werden",
            variant: "destructive"
          });
        };

        setCurrentAudio(audio);
        await audio.play();
      }

      // Mark as played
      await supabase
        .from('audio_announcements')
        .update({ played_at: new Date().toISOString() })
        .eq('id', announcement.id);

    } catch (error: any) {
      console.error('Playback error:', error);
      toast({
        title: "Wiedergabe-Fehler",
        description: error.message || "Audio konnte nicht abgespielt werden",
        variant: "destructive"
      });
    }
  };

  const stopAnnouncement = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    speechSynthesis.cancel();
    setPlayingId(null);
  };

  const toggleAnnouncementStatus = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('audio_announcements')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      fetchAnnouncements();
      toast({
        title: "Status geändert",
        description: `Durchsage ${!isActive ? 'aktiviert' : 'deaktiviert'}`
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: "Status konnte nicht geändert werden",
        variant: "destructive"
      });
    }
  };

  const handleDeleteAll = async () => {
    const confirmed = window.confirm(
      `Wirklich ALLE ${announcements.length} Durchsagen unwiderruflich löschen?`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      // First collect and delete all audio files from storage
      const audioFiles = announcements.filter(a => a.audio_file_path);
      
      for (const announcement of audioFiles) {
        const bucket = announcement.is_tts ? 'audio-announcements' : 'audio-files';
        const normalizedPath = announcement.audio_file_path!.replace(/^audio-announcements\//, '');
        
        console.log(`🗑️ Deleting file from bucket "${bucket}": ${normalizedPath}`);
        
        const { error: storageError } = await supabase.storage
          .from(bucket)
          .remove([normalizedPath]);
          
        if (storageError) {
          console.warn(`Storage deletion failed for ${normalizedPath}:`, storageError);
        }
      }

      // Delete all announcements from database
      const { error: dbError } = await supabase
        .from('audio_announcements')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

      if (dbError) throw dbError;

      toast({
        title: "Alle gelöscht",
        description: `${announcements.length} Durchsagen wurden aus Datenbank und Storage gelöscht`
      });

      setAnnouncements([]);
      stopAnnouncement(); // Stop any playing audio
    } catch (error: any) {
      console.error('Delete all error:', error);
      toast({
        title: "Fehler",
        description: error.message || "Löschen fehlgeschlagen",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (announcement: AudioAnnouncement) => {
    const confirmed = window.confirm('Durchsage wirklich löschen?');
    if (!confirmed) return;
    
    try {
      // First try to delete audio file from storage (if present)
      if (announcement.audio_file_path) {
        const bucket = announcement.is_tts ? 'audio-announcements' : 'audio-files';
        
        // Normalize path - remove bucket prefix if accidentally included
        const normalizedPath = announcement.audio_file_path.replace(/^audio-announcements\//, '');
        
        console.log(`🗑️ Deleting file from bucket "${bucket}": ${normalizedPath}`);
        
        const { error: storageError } = await supabase.storage
          .from(bucket)
          .remove([normalizedPath]);
          
        if (storageError) {
          console.warn('Storage deletion error (continuing with DB deletion):', storageError);
        } else {
          console.log(`✅ Successfully deleted file from storage: ${normalizedPath}`);
        }
      }

      // Delete database record
      const { error: dbError } = await supabase
        .from('audio_announcements')
        .delete()
        .eq('id', announcement.id);
        
      if (dbError) throw dbError;

      toast({ 
        title: 'Gelöscht', 
        description: 'Durchsage wurde aus Datenbank und Storage gelöscht' 
      });
      
      // Stop audio if this announcement is playing
      if (playingId === announcement.id) {
        stopAnnouncement();
      }
      
      fetchAnnouncements();
    } catch (e: any) {
      console.error('Delete error:', e);
      toast({ 
        title: 'Fehler', 
        description: e.message || 'Löschen fehlgeschlagen', 
        variant: 'destructive' 
      });
    }
  };

  // This permission check is now handled by the usePermissionGuard or routes
  // Individual users can be granted the audio_announcements permission even with lower levels

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <h1 className="text-2xl font-bold">Audio-Durchsagen</h1>
      </div>

      {/* TTS Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Text-to-Speech Durchsage erstellen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTTSSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Titel *</label>
              <Input
                value={ttsForm.title}
                onChange={(e) => setTtsForm({ ...ttsForm, title: e.target.value })}
                placeholder="Titel der Durchsage"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Beschreibung</label>
              <Input
                value={ttsForm.description}
                onChange={(e) => setTtsForm({ ...ttsForm, description: e.target.value })}
                placeholder="Kurze Beschreibung"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Text *</label>
              <Textarea
                value={ttsForm.text}
                onChange={(e) => setTtsForm({ ...ttsForm, text: e.target.value })}
                placeholder="Text für die Sprachausgabe..."
                rows={4}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">TTS-Typ</label>
              <select 
                className="w-full p-2 border rounded-md"
                value={ttsForm.tts_type}
                onChange={(e) => setTtsForm({ ...ttsForm, tts_type: e.target.value as 'piper' | 'browser' })}
              >
                <option value="piper">PiperTTS</option>
                <option value="browser">Browser TTS</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Geplante Zeit</label>
              <Input
                type="datetime-local"
                value={ttsForm.schedule_date}
                onChange={(e) => setTtsForm({ ...ttsForm, schedule_date: e.target.value })}
              />
            </div>
            
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Erstelle...' : 'TTS-Durchsage erstellen'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Audio Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Audio-Datei hochladen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAudioUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Titel *</label>
              <Input
                value={audioForm.title}
                onChange={(e) => setAudioForm({ ...audioForm, title: e.target.value })}
                placeholder="Titel der Durchsage"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Beschreibung</label>
              <Input
                value={audioForm.description}
                onChange={(e) => setAudioForm({ ...audioForm, description: e.target.value })}
                placeholder="Kurze Beschreibung"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Audio-Datei *</label>
              <Input
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioForm({ ...audioForm, audio_file: e.target.files?.[0] || null })}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Geplante Zeit</label>
              <Input
                type="datetime-local"
                value={audioForm.schedule_date}
                onChange={(e) => setAudioForm({ ...audioForm, schedule_date: e.target.value })}
              />
            </div>
            
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Lade hoch...' : 'Audio hochladen'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Announcements List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Durchsagen-Übersicht</CardTitle>
            {announcements.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAll}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Alle löschen ({announcements.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{announcement.title}</h3>
                    <Badge variant={announcement.is_active ? "default" : "secondary"}>
                      {announcement.is_active ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                    <Badge variant="outline">
                      {announcement.is_tts ? 'TTS' : 'Audio'}
                    </Badge>
                    {announcement.is_tts && (
                      <Badge variant="secondary">
                        {announcement.audio_file_path ? '📁 Datei (Piper)' : '🗣️ Browser TTS'}
                      </Badge>
                    )}
                  </div>
                  
                  {announcement.description && (
                    <p className="text-sm text-muted-foreground mb-2">{announcement.description}</p>
                  )}
                  
                  {announcement.is_tts && announcement.tts_text && !announcement.audio_file_path && (
                    <div className="mb-2">
                      <OfflineTTS text={announcement.tts_text} voiceId={announcement.voice_id} />
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Erstellt: {new Date(announcement.created_at).toLocaleString('de-DE')}
                    {announcement.schedule_date && (
                      <> • Geplant: {new Date(announcement.schedule_date).toLocaleString('de-DE')}</>
                    )}
                    {announcement.played_at && (
                      <> • Abgespielt: {new Date(announcement.played_at).toLocaleString('de-DE')}</>
                    )}
                  </p>
                </div>
                
                <div className="flex sm:flex-row flex-col sm:items-center items-start gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => playingId === announcement.id ? stopAnnouncement() : playAnnouncement(announcement)}
                  >
                    {playingId === announcement.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleAnnouncementStatus(announcement.id, announcement.is_active)}
                  >
                    {announcement.is_active ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteAnnouncement(announcement)}
                    aria-label="Durchsage löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {announcements.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Keine Durchsagen vorhanden
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AudioAnnouncements;