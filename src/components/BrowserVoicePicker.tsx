import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BrowserVoicePickerProps {
  voices: SpeechSynthesisVoice[];
  selectedId?: string;
  onChange: (voiceId: string) => void;
  label?: string;
}

const BrowserVoicePicker: React.FC<BrowserVoicePickerProps> = ({ voices, selectedId, onChange, label }) => {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-foreground block">{label}</label>
      )}
      <Select value={selectedId} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Browser-Stimme wählen" />
        </SelectTrigger>
        <SelectContent>
          {voices.map((v) => (
            <SelectItem key={v.voiceURI} value={v.voiceURI}>
              <div className="flex items-center justify-between w-full">
                <span>{v.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{v.lang}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default BrowserVoicePicker;
