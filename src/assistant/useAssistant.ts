import { useCallback, useEffect, useRef, useState } from 'react';
import { saveResult } from '../db/historyDb';
import { AssistantLanguage, AssistantSpeed, AssistantState } from './types';
import { offlineAi } from './providers/ai';
import { OfflineVoice, onlineVoice, VoiceProvider } from './providers/voice';
import { createMockTextSource } from './providers/textSource';

export interface AssistantActions {
  read: () => Promise<void>;
  explain: () => Promise<void>;
  summarize: () => Promise<void>;
  speak: () => Promise<void>;
  close: () => Promise<void>;
  setSpeed: (speed: AssistantSpeed) => void;
}

export type UseAssistantResult = AssistantState & AssistantActions;

export function useAssistant(language: AssistantLanguage, mode: AssistantState['mode'] = 'offline'): UseAssistantResult & { voiceNote: string } {
  const [state, setState] = useState<AssistantState>(() => ({
    status: 'idle',
    resultText: '',
    sourceText: '',
    isSpeaking: false,
    speed: 1,
    mode,
    language,
  }));
  const requestRef = useRef(0);
  const [voiceNote, setVoiceNote] = useState('');

  useEffect(() => () => {
    void OfflineVoice.stop();
  }, []);

  const runTextAction = useCallback(async (
    action: 'read' | 'explain' | 'summarize',
  ) => {
    const requestId = ++requestRef.current;
    setState((previous) => ({
      ...previous,
      status: 'loading',
      resultText: '',
      language,
    }));

    try {
      const sourceText = await createMockTextSource(language).getScreenText();
      const resultText = action === 'read'
        ? sourceText
        : action === 'explain'
          ? await offlineAi.explain(sourceText, language)
          : await offlineAi.summarize(sourceText, language);

      if (requestId !== requestRef.current) return;
      setState((previous) => ({ ...previous, status: 'result', sourceText, resultText, isSpeaking: false }));

      if (action !== 'read') {
        await saveResult({
          type: action,
          sourceText,
          resultText,
          language,
          sourceApp: 'gabai',
        });
      }
    } catch (error) {
      console.error(`Assistant ${action} failed`, error);
      if (requestId === requestRef.current) {
        setState((previous) => ({
          ...previous,
          status: 'error',
          resultText: language === 'fil'
            ? 'May problema. Subukan ulit.'
            : 'Something went wrong. Try again.',
          isSpeaking: false,
        }));
      }
    }
  }, [language]);

  const read = useCallback(() => runTextAction('read'), [runTextAction]);
  const explain = useCallback(() => runTextAction('explain'), [runTextAction]);
  const summarize = useCallback(() => runTextAction('summarize'), [runTextAction]);

  const speak = useCallback(async () => {
    if (!state.resultText) return;
    try {
      const voice: VoiceProvider = mode === 'online' ? onlineVoice : OfflineVoice;
      await voice.stop();
      setState((previous) => ({ ...previous, isSpeaking: true }));
      try {
        await voice.speak(state.resultText, language, state.speed);
      } catch (error) {
        if (mode !== 'online') throw error;
        console.warn('Online voice unavailable; using offline voice.', error);
        setVoiceNote(language === 'fil'
          ? 'Walang internet, offline na boses ang gamit.'
          : 'No internet, using offline voice.');
        await OfflineVoice.speak(state.resultText, language, state.speed);
      }
    } catch (error) {
      console.error('Assistant speech failed', error);
      setState((previous) => ({
        ...previous,
        isSpeaking: false,
        status: 'error',
        resultText: language === 'fil'
          ? 'May problema. Subukan ulit.'
          : 'Something went wrong. Try again.',
      }));
      return;
    }
    setState((previous) => ({ ...previous, isSpeaking: false }));
  }, [language, mode, state.resultText, state.speed]);

  const close = useCallback(async () => {
    await OfflineVoice.stop();
    requestRef.current += 1;
    setState((previous) => ({ ...previous, isSpeaking: false, status: 'idle' }));
  }, []);

  const setSpeed = useCallback((speed: AssistantSpeed) => {
    setState((previous) => ({ ...previous, speed }));
  }, []);

  return { ...state, language, mode, read, explain, summarize, speak, close, setSpeed, voiceNote };
}
