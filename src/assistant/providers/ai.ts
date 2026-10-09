import { AssistantLanguage } from '../types';

export interface AiProvider {
  explain(text: string, lang: AssistantLanguage): Promise<string>;
  summarize(text: string, lang: AssistantLanguage): Promise<string>;
}

export const offlineAi: AiProvider = {
  async explain(text, lang) {
    await delay();
    if (lang === 'fil') {
      return `Simpleng paliwanag: ${text} Magbayad bago ang takdang petsa upang maiwasan ang dagdag na bayarin.`;
    }
    return `Simple explanation: ${text} Pay before the deadline to avoid an extra charge.`;
  },

  async summarize(text, lang) {
    await delay();
    if (lang === 'fil') {
      return `Buod: Bayaran ang bayarin bago mag-Abril 30.`;
    }
    return `Summary: Pay the bill before April 30.`;
  },
};

function delay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 1000 + Math.floor(Math.random() * 1001));
  });
}
