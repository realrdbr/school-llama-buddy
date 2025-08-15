import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Volume2, VolumeX, Mic, Upload, Play, Pause, RotateCcw, ArrowLeft } from 'lucide-react';
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
    voice_id: 'Aria',
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

  // Helper function for Web Speech API TTS playback
  const playTTSWithWebSpeech = (announcement: AudioAnnouncement) => {
    if (!announcement.tts_text) return;
    
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
    } else {
      toast({
        title: "Nicht unterstützt",
        description: "Text-to-Speech wird in diesem Browser nicht unterstützt",
        variant: "destructive"
      });
    }
  };

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
      // Try backend TTS first (Python TTS)
      let backendSuccess = false;
      try {
        const { data, error } = await supabase.functions.invoke('python-tts', {
          body: {
            text: ttsForm.text,
            title: ttsForm.title,
            description: ttsForm.description || `TTS-Durchsage erstellt von ${profile?.username}`,
            voice_id: ttsForm.voice_id,
            schedule_date: ttsForm.schedule_date || null,
            user_id: profile?.username
          }
        });

        if (error) throw error;
        
        if (data?.success) {
          backendSuccess = true;
          toast({
            title: "Erfolg",
            description: "TTS-Durchsage wurde erfolgreich mit Backend erstellt"
          });
        }
      } catch (backendError: any) {
        console.warn('Backend TTS failed, falling back to local storage:', backendError);
        
        // Fallback: Create TTS entry in database for Web Speech API playback
        const { error } = await supabase
          .from('audio_announcements')
          .insert({
            title: ttsForm.title,
            description: ttsForm.description || `TTS-Durchsage erstellt von ${profile?.username}`,
            is_tts: true,
            tts_text: ttsForm.text,
            voice_id: ttsForm.voice_id,
            schedule_date: ttsForm.schedule_date || null,
            is_active: true,
            created_by: profile?.id?.toString(),
            duration_seconds: Math.ceil(ttsForm.text.length / 15) // Grobe Schätzung
          });
        
        if (error) {
          console.error('Fallback TTS Error:', error);
          throw error;
        }
        
        toast({
          title: "Erfolg",
          description: "TTS-Durchsage wurde erfolgreich erstellt (Fallback zu Web Speech API)"
        });
      }
      
      // Reset form
      setTtsForm({
        title: '',
        description: '',
        text: '',
        voice_id: 'Aria',
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
      // Upload audio file to Supabase Storage
      const fileName = `${Date.now()}_${audioForm.audio_file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('audio-announcements')
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
          is_active: true,
          created_by: profile?.id?.toString()
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

      if (announcement.is_tts && announcement.tts_text) {
        // For TTS, first try backend-generated audio file, then fallback to Web Speech API
        if (announcement.audio_file_path) {
          // Backend-generated audio file exists
          const audioUrl = `/audio/${announcement.audio_file_path}`;
          
          try {
            const audio = new Audio(audioUrl);
            audio.onplay = () => setPlayingId(announcement.id);
            audio.onended = () => setPlayingId(null);
            audio.onerror = () => {
              // If backend audio fails, fallback to Web Speech API
              console.warn('Backend audio failed, falling back to Web Speech API');
              playTTSWithWebSpeech(announcement);
            };

            setCurrentAudio(audio);
            await audio.play();
            return;
          } catch (error) {
            console.warn('Failed to play backend audio, falling back to Web Speech API:', error);
          }
        }
        
        // Fallback to Web Speech API
        playTTSWithWebSpeech(announcement);
        return;
      } else if (announcement.audio_file_path) {
        // For uploaded audio files
        const { data } = supabase.storage
          .from('audio-announcements')
          .getPublicUrl(announcement.audio_file_path);
        
        audioUrl = data.publicUrl;
      }

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.onplay = () => setPlayingId(announcement.id);
        audio.onended = () => setPlayingId(null);
        audio.onerror = () => {
          setPlayingId(null);
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

  // Check if user has permission (Level 10 required)
  if (!profile || profile.permission_lvl < 10) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Keine Berechtigung</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Sie benötigen mindestens Berechtigung Level 10 um Audio-Durchsagen zu verwalten.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <CardTitle>Durchsagen-Übersicht</CardTitle>
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
                  </div>
                  
                  {announcement.description && (
                    <p className="text-sm text-muted-foreground mb-2">{announcement.description}</p>
                  )}
                  
                  {announcement.is_tts && announcement.tts_text && (
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
                
                <div className="flex items-center gap-2">
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