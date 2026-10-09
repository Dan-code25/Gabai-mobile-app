import { AssistantLanguage } from '../types';

export interface TextSource {
  getScreenText(): Promise<string>;
}

const SAMPLE_TEXT: Record<AssistantLanguage, string> = {
  en: 'NOTICE: Your water bill must be paid before April 30.',
  fil: 'PAABISO: Ang iyong bayarin sa tubig ay dapat bayaran bago mag-Abril 30.',
};

export const mockTextSource: TextSource = {
  async getScreenText() {
    await delay();
    return SAMPLE_TEXT.en;
  },
};

export function createMockTextSource(language: AssistantLanguage): TextSource {
  return {
    async getScreenText() {
      await delay();
      return SAMPLE_TEXT[language];
    },
  };
}

function delay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 1000 + Math.floor(Math.random() * 1001));
  });
}
