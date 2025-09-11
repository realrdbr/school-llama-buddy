import { useState, useCallback, useRef, useEffect } from 'react';
import { pipeline, Pipeline } from '@huggingface/transformers';
import { useToast } from '@/hooks/use-toast';

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
  modelId: string;
  type: 'web-speech' | 'transformers';
  description: string;
}

const AVAILABLE_VOICES: TTSVoice[] = [
  {
    id: 'web-speech-de',
    name: 'Browser Deutsch',
    language: 'de-DE',
    modelId: 'web-speech',
    type: 'web-speech',
    description: 'Standard Browser-Stimme'
  },
  {
    id: 'enhanced-web-speech',
    name: 'Browser Deutsch (Erweitert)',
    language: 'de-DE',
    modelId: 'web-speech-enhanced',
    type: 'web-speech',
    description: 'Browser-Stimme mit optimierten Einstellungen'
  }
];

interface UseTTSReturn {
  voices: TTSVoice[];
  selectedVoice: TTSVoice;
  setSelectedVoice: (voice: TTSVoice) => void;
  isLoading: boolean;
  isPlaying: boolean;
  speak: (text: string) => Promise<void>;
  stop: () => void;
  loadingProgress: number;
}

export const useTTS = (): UseTTSReturn => {
  const [selectedVoice, setSelectedVoice] = useState<TTSVoice>(AVAILABLE_VOICES[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const { toast } = useToast();
  
  const ttsRef = useRef<Pipeline | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Removed transformer model loading since the models don't exist
  // We'll focus on enhancing the web speech API instead
  const loadTransformerModel = useCallback(async (voice: TTSVoice) => {
    // No longer needed - all voices use web speech API
    return;
  }, []);

  const speakWithWebSpeech = useCallback((text: string, voice: TTSVoice) => {
    return new Promise<void>((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Enhanced voice selection
      const voices = speechSynthesis.getVoices();
      let selectedVoice = null;
      
      if (voice.id === 'enhanced-web-speech') {
        // Try to find the best German voice for enhanced mode
        selectedVoice = voices.find(v => 
          v.lang === 'de-DE' && (v.name.includes('Google') || v.name.includes('Microsoft'))
        ) || voices.find(v => v.lang.includes('de'));
      } else {
        // Standard German voice selection
        selectedVoice = voices.find(v => 
          v.lang.includes('de') || v.name.includes('German')
        );
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      utterance.lang = voice.language;
      
      // Enhanced settings for better quality
      if (voice.id === 'enhanced-web-speech') {
        utterance.rate = 0.85;
        utterance.pitch = 0.95;
        utterance.volume = 0.9;
      } else {
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 0.8;
      }
      
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => {
        setIsPlaying(false);
        resolve();
      };
      utterance.onerror = (event) => {
        setIsPlaying(false);
        reject(new Error('Speech synthesis error'));
      };
      
      speechSynthesis.speak(utterance);
    });
  }, []);

  // Removed transformers TTS since models don't exist - using enhanced web speech instead

  const stop = useCallback(() => {
    // Stop web speech
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    
    // Stop audio playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    setIsPlaying(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    try {
      stop();
      await speakWithWebSpeech(text, selectedVoice);
    } catch (error) {
      console.error('TTS Error:', error);
      toast({
        title: "TTS Fehler",
        description: "Fehler bei der Sprachwiedergabe",
        variant: "destructive"
      });
    }
  }, [selectedVoice, speakWithWebSpeech, stop, toast]);

  // No longer needed - all voices use web speech API

  return {
    voices: AVAILABLE_VOICES,
    selectedVoice,
    setSelectedVoice,
    isLoading,
    isPlaying,
    speak,
    stop,
    loadingProgress
  };
};