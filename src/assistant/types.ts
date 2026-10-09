export type AssistantStatus = 'idle' | 'loading' | 'result' | 'error';
export type AssistantMode = 'offline' | 'online';
export type AssistantLanguage = 'en' | 'fil';
export type AssistantSpeed = 0.75 | 1 | 1.25;

export interface AssistantState {
  status: AssistantStatus;
  resultText: string;
  sourceText: string;
  isSpeaking: boolean;
  speed: AssistantSpeed;
  mode: AssistantMode;
  language: AssistantLanguage;
}
