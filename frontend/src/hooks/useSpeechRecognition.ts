import { useCallback, useEffect, useRef, useState } from 'react';

interface Handlers {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Permiso de micrófono denegado. Actívalo desde el candado de la barra de direcciones.',
  'service-not-allowed': 'El navegador bloqueó el reconocimiento de voz.',
  'no-speech': 'No te escuché. Intenta de nuevo.',
  'audio-capture': 'No se detectó ningún micrófono.',
  network: 'El dictado por voz requiere conexión a Internet.',
  'language-not-supported': 'El idioma elegido no es compatible con el dictado.',
};

/** Dictado por voz con la Web Speech API (Chrome, Edge, Safari). Requiere HTTPS o localhost. */
export function useSpeechRecognition(lang: string) {
  const Rec: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;
  const supported = !!Rec;
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback((handlers: Handlers) => {
    if (!Rec) return;
    if (!window.isSecureContext) {
      setError('El micrófono solo funciona con HTTPS o en localhost. Abre el sistema desde una dirección segura.');
      return;
    }
    recRef.current?.abort?.();
    setError(null);

    const rec = new Rec();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = '';

    rec.onstart = () => setListening(true);
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      handlers.onInterim?.((finalText + interim).trim());
    };
    rec.onerror = (e: any) => {
      if (e.error !== 'aborted') setError(ERRORS[e.error] ?? 'No se pudo usar el micrófono.');
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const text = finalText.trim();
      if (text) handlers.onFinal(text);
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setError('No se pudo iniciar el micrófono. Intenta de nuevo.');
    }
  }, [Rec, lang]);

  const stop = useCallback(() => recRef.current?.stop?.(), []);

  useEffect(() => () => {
    const rec = recRef.current;
    if (rec) { rec.onend = null; rec.onresult = null; rec.abort?.(); }
  }, []);

  return { supported, listening, error, start, stop, clearError: () => setError(null) };
}
