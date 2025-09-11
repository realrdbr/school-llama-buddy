import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, Volume2, Loader2 } from 'lucide-react';
import { TTSVoice } from '@/hooks/useTTS';

interface VoiceSelectorProps {
  voices: TTSVoice[];
  selectedVoice: TTSVoice;
  onVoiceChange: (voice: TTSVoice) => void;
  isLoading: boolean;
  loadingProgress: number;
  onPreview: () => void;
  isPlaying: boolean;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  voices,
  selectedVoice,
  onVoiceChange,
  isLoading,
  loadingProgress,
  onPreview,
  isPlaying
}) => {
  const handleVoiceChange = (voiceId: string) => {
    const voice = voices.find(v => v.id === voiceId);
    if (voice) {
      onVoiceChange(voice);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium text-foreground mb-2 block">
            Stimme auswählen
          </label>
          <Select value={selectedVoice.id} onValueChange={handleVoiceChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Stimme wählen" />
            </SelectTrigger>
            <SelectContent>
              {voices.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex flex-col">
                      <span>{voice.name}</span>
                      <span className="text-xs text-muted-foreground">{voice.description}</span>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Badge 
                        variant={voice.id.includes('enhanced') ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {voice.id.includes('enhanced') ? 'Erweitert' : 'Standard'}
                      </Badge>
                      {voice.gender && (
                        <Badge 
                          variant="outline"
                          className="text-xs"
                        >
                          {voice.gender === 'male' ? '♂' : voice.gender === 'female' ? '♀' : '⚪'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button
          onClick={onPreview}
          size="sm"
          variant="outline"
          disabled={isLoading}
          className="mt-6"
        >
          {isPlaying ? (
            <>
              <Volume2 className="h-4 w-4 mr-2" />
              Wiedergabe...
            </>
          ) : isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Laden...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Testen
            </>
          )}
        </Button>
      </div>

      {/* Voice description */}
      <p className="text-sm text-muted-foreground">
        {selectedVoice.description}
      </p>

      {/* Enhanced voice info */}
      {selectedVoice.id.includes('enhanced') && (
        <div className="p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="default">Optimiert</Badge>
            <span className="text-sm text-muted-foreground">
              {selectedVoice.name}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedVoice.description}
          </p>
        </div>
      )}

      {selectedVoice.id === 'web-speech-slow' && (
        <div className="p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="default">Speziell</Badge>
            <span className="text-sm text-muted-foreground">
              Langsame Wiedergabe
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ideal für wichtige Durchsagen die deutlich verstanden werden müssen
          </p>
        </div>
      )}
    </div>
  );
};

export default VoiceSelector;