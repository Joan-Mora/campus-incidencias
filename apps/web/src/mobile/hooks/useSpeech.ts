import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  const scope = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/**
 * Dictado por voz con la Web Speech API. `onFinal` recibe cada frase confirmada;
 * `interim` muestra lo que se va reconociendo.
 */
export function useSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const callback = useRef(onFinal);
  callback.current = onFinal;
  const supported = recognitionCtor() !== null;

  useEffect(() => () => recognition.current?.stop(), []);

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const instance = new Ctor();
    instance.lang = 'es-CO';
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = (event) => {
      let partial = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) callback.current(result[0].transcript.trim());
        else partial += result[0].transcript;
      }
      setInterim(partial);
    };
    instance.onend = () => {
      setListening(false);
      setInterim('');
    };
    instance.onerror = () => {
      setListening(false);
      setInterim('');
    };
    recognition.current = instance;
    instance.start();
    setListening(true);
  }, []);

  return { supported, listening, interim, start, stop };
}
