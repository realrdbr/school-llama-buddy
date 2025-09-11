import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTTS } from '@/hooks/useTTS';
import VoiceSelector from './VoiceSelector';

interface OfflineTTSProps {
  text: string;
  voiceId?: string;
  onComplete?: () => void;
  showVoiceSettings?: boolean;
}

const OfflineTTS: React.FC<OfflineTTSProps> = ({ 
  text, 
  voiceId, 
  onComplete,
  showVoiceSettings = true 
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const {
    voices,
    selectedVoice,
    setSelectedVoice,
    isLoading,
    isPlaying,
    speak,
    stop,
    loadingProgress
  } = useTTS();

  const handlePlay = async () => {
    try {
      await speak(text);
      onComplete?.();
    } catch (error) {
      console.error('TTS Error:', error);
    }
  };

  const handlePreview = async () => {
    try {
      await speak("Dies ist eine Vorschau der ausgewählten Stimme.");
    } catch (error) {
      console.error('Preview Error:', error);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={isPlaying ? stop : handlePlay}
        size="sm"
        variant="outline"
        className="flex items-center gap-2"
        disabled={isLoading}
      >
        {isPlaying ? (
          <>
            <VolumeX className="h-4 w-4" />
            Stoppen
          </>
        ) : (
          <>
            <Volume2 className="h-4 w-4" />
            {isLoading ? 'Laden...' : 'Abspielen'}
          </>
        )}
      </Button>
      
      {showVoiceSettings && (
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>TTS Einstellungen</DialogTitle>
            </DialogHeader>
            <VoiceSelector
              voices={voices}
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
              isLoading={isLoading}
              loadingProgress={loadingProgress}
              onPreview={handlePreview}
              isPlaying={isPlaying}
            />
          </DialogContent>
        </Dialog>
      )}
      
      {text && (
        <span className="text-xs text-muted-foreground">
          {selectedVoice.name} bereit
        </span>
      )}
    </div>
  );
};

export default OfflineTTS;