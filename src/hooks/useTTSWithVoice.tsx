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

      window.speechSynthesis.cancel();

      const start = async () => {
        // Ensure voices are loaded
        let browserVoices = window.speechSynthesis.getVoices();
        if (!browserVoices.length) {
          await new Promise<void>((res) => {
            let attempts = 0;
            const id = setInterval(() => {
              browserVoices = window.speechSynthesis.getVoices();
              if (browserVoices.length || attempts++ > 30) {
                clearInterval(id);
                res();
              }
            }, 100);
          });
        }

        // Try direct match by voiceURI or name
        let browserVoice = browserVoices.find(v => v.voiceURI === voiceId) || browserVoices.find(v => v.name === voiceId);

        const utterance = new SpeechSynthesisUtterance(text);

        if (browserVoice) {
          utterance.voice = browserVoice;
          utterance.lang = browserVoice.lang || 'de-DE';
          utterance.rate = 0.95;
          utterance.pitch = 1.0;
          utterance.volume = 0.9;
        } else {
          // Otherwise: interpret as one of our presets and pick heuristically
          const voice = AVAILABLE_VOICES[voiceId] || AVAILABLE_VOICES['web-speech-de-female'];

          let selectedVoice: SpeechSynthesisVoice | null = null;

          if (voice.gender === 'male') {
            selectedVoice = browserVoices.find(v => v.lang.includes('de') && (
              v.name.toLowerCase().includes('male') ||
              v.name.toLowerCase().includes('mann') ||
              v.name.toLowerCase().includes('andreas') ||
              v.name.toLowerCase().includes('thomas') ||
              v.name.toLowerCase().includes('david')
            )) || browserVoices.find(v => v.lang.includes('de') && v.name.includes('2'));
          } else if (voice.gender === 'female') {
            selectedVoice = browserVoices.find(v => v.lang.includes('de') && (
              v.name.toLowerCase().includes('female') ||
              v.name.toLowerCase().includes('frau') ||
              v.name.toLowerCase().includes('anna') ||
              v.name.toLowerCase().includes('petra') ||
              v.name.toLowerCase().includes('sabine') ||
              v.name.toLowerCase().includes('maria')
            )) || browserVoices.find(v => v.lang === 'de-DE');
          } else {
            selectedVoice = browserVoices.find(v => v.lang.includes('de'));
          }

          if (voice.id.includes('enhanced')) {
            const premiumVoice = browserVoices.find(v => v.lang === 'de-DE' && (
              v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Neural') || v.name.includes('Premium')
            ));
            if (premiumVoice) selectedVoice = premiumVoice;
          }

          if (!selectedVoice) {
            selectedVoice = browserVoices.find(v => v.lang.includes('de') || v.name.includes('German')) || null;
          }

          if (selectedVoice) {
            utterance.voice = selectedVoice;
          }

          utterance.lang = voice.language;

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
        }

        utterance.onend = () => resolve();
        utterance.onerror = () => reject(new Error('Speech synthesis error'));

        window.speechSynthesis.speak(utterance);
      };

      // Start async flow
      start();
    });
  }, []);

  return { speakWithVoice };
};