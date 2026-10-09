import * as Speech from 'expo-speech';
import { AssistantLanguage, AssistantSpeed } from '../types';

export interface VoiceProvider {
  speak(text: string, language: AssistantLanguage, speed: AssistantSpeed): Promise<void>;
  stop(): Promise<void>;
}

export interface OnlineVoice {
  speak(text: string, language: AssistantLanguage, speed: AssistantSpeed): Promise<void>;
  stop(): Promise<void>;
}

export const onlineVoice: OnlineVoice = {
  async speak() {
    throw new Error('Online voice is not available yet.');
  },
  async stop() {
    return;
  },
};

export const OfflineVoice: VoiceProvider = {
  speak(text, language, speed) {
    return new Promise((resolve, reject) => {
      const primaryLanguage = language === 'fil' ? 'fil-PH' : 'en-US';
      Speech.speak(text, {
        language: primaryLanguage,
        rate: speed,
        onDone: resolve,
        onStopped: resolve,
        onError: () => {
          if (primaryLanguage === 'en-US') {
            reject(new Error('Speech failed.'));
            return;
          }

          Speech.speak(text, {
            language: 'en-US',
            rate: speed,
            onDone: resolve,
            onStopped: resolve,
            onError: () => reject(new Error('Speech failed.')),
          });
        },
      });
    });
  },

  async stop() {
    await Speech.stop();
  },
};
