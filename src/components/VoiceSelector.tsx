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
                    <span>{voice.name}</span>
                    <Badge 
                      variant={voice.type === 'transformers' ? 'default' : 'secondary'}
                      className="ml-2"
                    >
                      {voice.type === 'transformers' ? 'KI' : 'Browser'}
                    </Badge>
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

      {/* Loading progress for transformer models */}
      {isLoading && selectedVoice.type === 'transformers' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Model wird geladen...</span>
            <span>{loadingProgress}%</span>
          </div>
          <Progress value={loadingProgress} className="w-full" />
        </div>
      )}

      {/* Model info for transformer voices */}
      {selectedVoice.type === 'transformers' && !isLoading && (
        <div className="p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="default">KI-Model</Badge>
            <span className="text-sm text-muted-foreground">
              {selectedVoice.modelId}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Läuft komplett lokal im Browser
          </p>
        </div>
      )}
    </div>
  );
};

export default VoiceSelector;