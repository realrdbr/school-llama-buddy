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
    id: 'speecht5-german',
    name: 'SpeechT5 Deutsch',
    language: 'de-DE',
    modelId: 'microsoft/speecht5_tts',
    type: 'transformers',
    description: 'KI-Stimme mit hoher Qualität'
  },
  {
    id: 'mms-tts-german',
    name: 'MMS TTS Deutsch',
    language: 'de-DE',
    modelId: 'facebook/mms-tts-deu',
    type: 'transformers',
    description: 'Meta\'s mehrsprachige Stimme'
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

  const loadTransformerModel = useCallback(async (voice: TTSVoice) => {
    if (voice.type !== 'transformers') return;
    
    try {
      setIsLoading(true);
      setLoadingProgress(10);
      
      toast({
        title: "Model wird geladen",
        description: `${voice.name} wird heruntergeladen...`,
      });

      setLoadingProgress(30);
      
      // Load the TTS pipeline
      const tts = await pipeline('text-to-speech', voice.modelId, {
        device: 'webgpu',
        progress_callback: (progress: any) => {
          if (progress.status === 'downloading') {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setLoadingProgress(30 + (percent * 0.6));
          }
        }
      });
      
      ttsRef.current = tts;
      setLoadingProgress(100);
      
      toast({
        title: "Model geladen",
        description: `${voice.name} ist bereit zur Verwendung`,
      });
    } catch (error) {
      console.error('Error loading TTS model:', error);
      toast({
        title: "Fehler beim Laden",
        description: "Fallback auf Browser-TTS",
        variant: "destructive"
      });
      // Fallback to web speech
      setSelectedVoice(AVAILABLE_VOICES[0]);
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
    }
  }, [toast]);

  const speakWithWebSpeech = useCallback((text: string, voice: TTSVoice) => {
    return new Promise<void>((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Try to find a matching voice
      const voices = speechSynthesis.getVoices();
      const germanVoice = voices.find(v => 
        v.lang.includes('de') || v.name.includes('German')
      );
      
      if (germanVoice) {
        utterance.voice = germanVoice;
      }
      
      utterance.lang = voice.language;
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      
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

  const speakWithTransformers = useCallback(async (text: string) => {
    if (!ttsRef.current) {
      throw new Error('TTS model not loaded');
    }

    try {
      // Generate audio using the transformer model
      const result = await ttsRef.current(text);
      
      // Convert the audio tensor to a playable format
      // Note: This is a simplified implementation
      // In practice, you'd need to properly handle the audio tensor
      const audioData = result.audio;
      
      // Create audio context and play
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(audioData.buffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      setIsPlaying(true);
      source.start();
      
      source.onended = () => {
        setIsPlaying(false);
      };
    } catch (error) {
      console.error('Error with transformers TTS:', error);
      // Fallback to web speech
      await speakWithWebSpeech(text, selectedVoice);
    }
  }, [selectedVoice, speakWithWebSpeech]);

  const speak = useCallback(async (text: string) => {
    try {
      stop();
      
      if (selectedVoice.type === 'web-speech') {
        await speakWithWebSpeech(text, selectedVoice);
      } else {
        // Load model if not already loaded
        if (!ttsRef.current) {
          await loadTransformerModel(selectedVoice);
        }
        await speakWithTransformers(text);
      }
    } catch (error) {
      console.error('TTS Error:', error);
      toast({
        title: "TTS Fehler",
        description: "Fehler bei der Sprachwiedergabe",
        variant: "destructive"
      });
    }
  }, [selectedVoice, speakWithWebSpeech, speakWithTransformers, loadTransformerModel, toast]);

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

  // Auto-load transformer models when voice is selected
  useEffect(() => {
    if (selectedVoice.type === 'transformers' && !ttsRef.current) {
      loadTransformerModel(selectedVoice);
    }
  }, [selectedVoice, loadTransformerModel]);

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