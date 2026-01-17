import { z } from 'zod';

export const webSearchTools = [
  'searchWeb',
] as const;

export type WebSearchTools = typeof webSearchTools[number];

export interface WebSearchToolsConfig {
  tavilyApiKey?: string;
  dataStream: any; // Type this based on your actual dataStream type
}

export class WebSearchToolsManager {
  private toolCallCache = new Set<string>();
  private config: WebSearchToolsConfig;

  constructor(config: WebSearchToolsConfig) {
    this.config = config;
  }

  private shouldExecuteToolCall(toolName: string, params: any): boolean {
    const key = JSON.stringify({ toolName, params });
    if (this.toolCallCache.has(key)) {
      return false;
    }
    this.toolCallCache.add(key);
    return true;
  }

  public getTools() {
    if (!this.config.tavilyApiKey) {
      return {};
    }

    return {
      searchWeb: {
        description: 'Search the web for real-time information, news, articles, or any current events. Use this tool when you need to find up-to-date information that is not in your training data, or when users ask about recent events, news, or current information. This tool can search for financial news, company information, market trends, or any other topic. IMPORTANT: When using information from search results, always cite the source URLs in your response.',
        parameters: z.object({
          query: z.string().describe('The search query to look up on the web. Be specific and include relevant keywords for better results.'),
          maxResults: z.number().optional().default(5).describe('The maximum number of search results to return (default: 5, max: 10)'),
        }),
        execute: async ({ query, maxResults }: { query: string; maxResults?: number }) => {
          if (!this.shouldExecuteToolCall('searchWeb', { query, maxResults })) {
            console.log('Skipping duplicate searchWeb call:', { query, maxResults });
            return null;
          }

          this.config.dataStream.writeData({
            type: 'tool-loading',
            content: {
              tool: 'searchWeb',
              isLoading: true,
              message: `Searching the web for: ${query}...`
            }
          });

          try {
            const response = await fetch('https://api.tavily.com/search', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                api_key: this.config.tavilyApiKey,
                query: query,
                search_depth: 'basic',
                include_answer: true,
                include_images: false,
                include_raw_content: false,
                max_results: Math.min(maxResults || 5, 10),
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('Tavily API Error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
              });
              throw new Error(`Tavily API error: ${response.status} ${errorText}`);
            }

            const data = await response.json();

            this.config.dataStream.writeData({
              type: 'tool-loading',
              content: {
                tool: 'searchWeb',
                isLoading: false,
                message: null,
              }
            });

            // Format the response in a way that's useful for the AI
            // Include sources information for citation
            const formattedResults = (data.results || []).map((result: any) => ({
              title: result.title || '',
              url: result.url || '',
              content: result.content || '',
              score: result.score || 0,
            }));

            const sources = (data.results || []).map((result: any) => ({
              title: result.title || '',
              url: result.url || '',
            }));

            return {
              query: query,
              answer: data.answer || 'No direct answer available',
              results: formattedResults,
              sources: sources,
              // Format a string that makes it clear sources should be cited
              note: `IMPORTANT: All information above comes from web search results. Please cite the source URLs when using this information in your response. Sources: ${sources.map((s: any, i: number) => `${i + 1}. ${s.title} (${s.url})`).join('; ')}`,
            };
          } catch (error) {
            this.config.dataStream.writeData({
              type: 'tool-loading',
              content: {
                tool: 'searchWeb',
                isLoading: false,
                message: null,
              }
            });
            throw error;
          }
        },
      },
    };
  }
}
