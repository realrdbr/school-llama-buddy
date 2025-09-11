import { useCallback } from 'react';
import { TTSVoice } from '@/hooks/useTTS';

interface UseTTSWithVoiceReturn {
  speakWithVoice: (text: string, voiceId: string) => Promise<void>;
}

// Available voices list - same as in useTTS but as a lookup
const AVAILABLE_VOICES: { [key: string]: TTSVoice } = {
  'web-speech-de-female': {
    id: 'web-speech-de-female',
    name: 'Browser Deutsch (Weiblich)',
    language: 'de-DE',
    modelId: 'web-speech',
    type: 'web-speech',
    description: 'Standard weibliche Browser-Stimme',
    gender: 'female'
  },
  'web-speech-de-male': {
    id: 'web-speech-de-male',
    name: 'Browser Deutsch (Männlich)',
    language: 'de-DE',
    modelId: 'web-speech-male',
    type: 'web-speech',
    description: 'Männliche Browser-Stimme',
    gender: 'male'
  },
  'enhanced-web-speech-female': {
    id: 'enhanced-web-speech-female',
    name: 'Erweitert Weiblich',
    language: 'de-DE',
    modelId: 'web-speech-enhanced-female',
    type: 'web-speech',
    description: 'Optimierte weibliche Stimme mit besserer Qualität',
    gender: 'female'
  },
  'enhanced-web-speech-male': {
    id: 'enhanced-web-speech-male',
    name: 'Erweitert Männlich',
    language: 'de-DE',
    modelId: 'web-speech-enhanced-male',
    type: 'web-speech',
    description: 'Optimierte männliche Stimme mit besserer Qualität',
    gender: 'male'
  },
  'web-speech-slow': {
    id: 'web-speech-slow',
    name: 'Langsam & Deutlich',
    language: 'de-DE',
    modelId: 'web-speech-slow',
    type: 'web-speech',
    description: 'Langsame, deutliche Aussprache für wichtige Durchsagen',
    gender: 'neutral'
  }
};

export const useTTSWithVoice = (): UseTTSWithVoiceReturn => {
  const speakWithVoice = useCallback((text: string, voiceId: string) => {
    return new Promise<void>((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      speechSynthesis.cancel();
      
      const voice = AVAILABLE_VOICES[voiceId] || AVAILABLE_VOICES['web-speech-de-female'];
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Enhanced voice selection based on voice type
      const voices = speechSynthesis.getVoices();
      let selectedVoice = null;
      
      // Voice selection based on gender and quality preferences
      if (voice.gender === 'male') {
        selectedVoice = voices.find(v => 
          v.lang.includes('de') && (
            v.name.toLowerCase().includes('male') || 
            v.name.toLowerCase().includes('mann') ||
            v.name.toLowerCase().includes('herr') ||
            v.name.toLowerCase().includes('michael') ||
            v.name.toLowerCase().includes('thomas') ||
            v.name.toLowerCase().includes('david')
          )
        ) || voices.find(v => 
          v.lang.includes('de') && v.name.includes('2')
        );
      } else if (voice.gender === 'female') {
        selectedVoice = voices.find(v => 
          v.lang.includes('de') && (
            v.name.toLowerCase().includes('female') ||
            v.name.toLowerCase().includes('frau') ||
            v.name.toLowerCase().includes('anna') ||
            v.name.toLowerCase().includes('petra') ||
            v.name.toLowerCase().includes('sabine') ||
            v.name.toLowerCase().includes('maria')
          )
        ) || voices.find(v => v.lang === 'de-DE');
      } else {
        selectedVoice = voices.find(v => v.lang.includes('de'));
      }
      
      // Enhanced voice selection for improved quality
      if (voice.id.includes('enhanced')) {
        const premiumVoice = voices.find(v => 
          v.lang === 'de-DE' && (
            v.name.includes('Google') || 
            v.name.includes('Microsoft') ||
            v.name.includes('Premium') ||
            v.name.includes('Neural')
          )
        );
        if (premiumVoice) {
          selectedVoice = premiumVoice;
        }
      }
      
      if (!selectedVoice) {
        selectedVoice = voices.find(v => 
          v.lang.includes('de') || v.name.includes('German')
        );
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      utterance.lang = voice.language;
      
      // Adjust speech parameters based on voice type
      if (voice.id === 'web-speech-slow') {
        utterance.rate = 0.6;
        utterance.pitch = 1.0;   
        utterance.volume = 0.9;
      } else if (voice.id.includes('enhanced')) {
        utterance.rate = 0.85;
        utterance.pitch = voice.gender === 'male' ? 0.85 : 0.95;
        utterance.volume = 0.9;
      } else {
        utterance.rate = 0.9;
        utterance.pitch = voice.gender === 'male' ? 0.9 : 1.0;
        utterance.volume = 0.8;
      }
      
      utterance.onstart = () => {};
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error('Speech synthesis error'));
      
      speechSynthesis.speak(utterance);
    });
  }, []);

  return { speakWithVoice };
};