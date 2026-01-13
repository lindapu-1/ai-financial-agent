import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { experimental_wrapLanguageModel as wrapLanguageModel } from 'ai';

import { customMiddleware } from './custom-middleware';
import { models } from './models';

export const customModel = (apiIdentifier: string, apiKey?: string) => {
  const modelDefinition = models.find(m => m.apiIdentifier === apiIdentifier);
  const providerName = modelDefinition?.provider ?? 'openai';

  let provider;

  if (providerName === 'google') {
    provider = createGoogleGenerativeAI({ 
      apiKey: apiKey || process.env.GOOGLE_API_KEY 
    });
    return wrapLanguageModel({
      model: provider(apiIdentifier),
      middleware: customMiddleware,
    });
  } 
  
  if (providerName === 'deepseek') {
    provider = createOpenAI({
      apiKey: apiKey || process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com/v1',
    });
    return wrapLanguageModel({
      model: provider.chat(apiIdentifier),
      middleware: customMiddleware,
    });
  }

  // Default to OpenAI
  provider = createOpenAI({ 
    apiKey: apiKey || process.env.OPENAI_API_KEY, 
    compatibility: 'strict' 
  });
  
  return wrapLanguageModel({
    model: provider.chat(apiIdentifier),
    middleware: customMiddleware,
  });
};
