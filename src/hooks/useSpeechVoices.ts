import { useEffect, useState } from 'react';

export interface SpeechVoicesResult {
  voices: SpeechSynthesisVoice[];
  ready: boolean;
  defaultVoiceId?: string; // Prefer de-DE voiceURI if available
}

export function useSpeechVoices(languagePref: string = 'de'): SpeechVoicesResult {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    function loadVoices() {
      if (!('speechSynthesis' in window)) return;
      const all = window.speechSynthesis.getVoices();
      if (all && all.length) {
        const filtered = all.filter(v => v.lang.toLowerCase().startsWith(languagePref.toLowerCase()));
        setVoices(filtered.length ? filtered : all);
        setReady(true);
      }
    }

    if ('speechSynthesis' in window) {
      loadVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        if (!mounted) return;
        loadVoices();
      };
      // Safari sometimes needs a tick
      if (!voices.length) {
        setTimeout(loadVoices, 300);
      }
    }

    return () => {
      mounted = false;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [languagePref]);

  const defaultVoiceId = voices.find(v => v.lang.toLowerCase().startsWith(languagePref.toLowerCase()))?.voiceURI
    || voices[0]?.voiceURI;

  return { voices, ready, defaultVoiceId };
}
