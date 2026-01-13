// Define your models here.

export interface Model {
  id: string;
  label: string;
  apiIdentifier: string;
  description: string;
  provider: 'openai' | 'google' | 'deepseek';
}

export const models: Array<Model> = [
  // OpenAI Models
  {
    id: 'gpt-4o',
    label: 'GPT-4o (recommend)',
    apiIdentifier: 'gpt-4o',
    description: 'Omni-purpose model for complex tasks',
    provider: 'openai',
  },
  
  // DeepSeek Models
  {
    id: 'deepseek-chat',
    label: 'DeepSeek V3',
    apiIdentifier: 'deepseek-chat',
    description: 'DeepSeek V3 chat model',
    provider: 'deepseek',
  },
  
  // Google Gemini Models
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    apiIdentifier: 'gemini-2.5-pro',
    description: 'Latest flagship Gemini 2.5 model',
    provider: 'google',
  },
  {
    id: 'gemini-3-pro-preview',
    label: 'Gemini 3 Pro Preview (very slow)',
    apiIdentifier: 'gemini-3-pro-preview',
    description: 'Next-generation Gemini 3 model',
    provider: 'google',
  },
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview (very slow)',
    apiIdentifier: 'gemini-3-flash-preview',
    description: 'Fast next-generation Gemini 3 model',
    provider: 'google',
  },
] as const;

export const DEFAULT_MODEL_NAME: string = 'gpt-4o';
