import { auth } from '@/app/(auth)/auth';
import {
  getPortfolioById,
  getStocksByPortfolioId,
} from '@/lib/db/queries';
import { customModel } from '@/lib/ai';
import { DEFAULT_MODEL_NAME } from '@/lib/ai/models';
import { generateText } from 'ai';

function isPlaceholderKey(value: string | undefined | null) {
  const v = (value ?? '').trim();
  if (!v) return true;
  return (
    v === '****' ||
    v === 'changeme' ||
    v === 'your-openai-api-key' ||
    v === 'your-financial-datasets-api-key'
  );
}

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const portfolio = await getPortfolioById({ id });

  if (!portfolio) {
    return new Response('Portfolio not found', { status: 404 });
  }

  if (portfolio.userId !== session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const stocks = await getStocksByPortfolioId({ portfolioId: id });

  if (stocks.length === 0) {
    return Response.json({
      analysis: 'Portfolio is empty. Please add stocks to get analysis.',
    });
  }

  const tickers = stocks.map((s) => s.ticker);
  const financialDatasetsApiKey = process.env.FINANCIAL_DATASETS_API_KEY;

  if (isPlaceholderKey(financialDatasetsApiKey)) {
    return new Response('Financial Datasets API key is required', { status: 400 });
  }

  // Fetch news and financial data for each stock
  const stockDataPromises = tickers.map(async (ticker) => {
    try {
      // Fetch news
      const newsResponse = await fetch(
        `https://api.financialdatasets.ai/news/?ticker=${ticker}&limit=5`,
        {
          headers: {
            'X-API-Key': financialDatasetsApiKey!,
          },
        }
      );
      const news = newsResponse.ok ? await newsResponse.json() : [];

      // Fetch snapshot price
      const priceResponse = await fetch(
        `https://api.financialdatasets.ai/prices/snapshot?ticker=${ticker}`,
        {
          headers: {
            'X-API-Key': financialDatasetsApiKey!,
          },
        }
      );
      const price = priceResponse.ok ? await priceResponse.json() : null;

      return {
        ticker,
        news: Array.isArray(news) ? news : [],
        price,
      };
    } catch (error) {
      console.error(`Error fetching data for ${ticker}:`, error);
      return {
        ticker,
        news: [],
        price: null,
      };
    }
  });

  const stockData = await Promise.all(stockDataPromises);

  // Prepare context for GPT analysis
  const context = stockData
    .map((data) => {
      let summary = `Stock: ${data.ticker}\n`;
      if (data.price) {
        summary += `Current Price: $${data.price.price || 'N/A'}\n`;
        summary += `Market Cap: ${data.price.marketCap || 'N/A'}\n`;
      }
      if (data.news && data.news.length > 0) {
        summary += `Recent News:\n`;
        data.news.forEach((article: any) => {
          summary += `- ${article.title || article.headline || 'N/A'} (${article.date || 'N/A'})\n`;
          if (article.summary) {
            summary += `  ${article.summary.substring(0, 200)}...\n`;
          }
        });
      }
      return summary;
    })
    .join('\n\n');

  const modelApiKey = process.env.OPENAI_API_KEY;

  if (isPlaceholderKey(modelApiKey)) {
    return new Response('OpenAI API key is required', { status: 400 });
  }

  const model = customModel(DEFAULT_MODEL_NAME, modelApiKey);

  const systemPrompt = `You are a financial analyst providing portfolio analysis. Analyze the provided stock information including recent news, financial performance, and market data. Provide insights on:
1. Financial performance updates
2. Business developments and news
3. Capital and market information
4. Overall portfolio health and recommendations

Keep the analysis concise but comprehensive.`;

  try {
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: `Please analyze the following portfolio holdings:\n\n${context}\n\nProvide a comprehensive investment analysis.`,
    });

    return Response.json({
      analysis: text,
      stocks: tickers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating analysis:', error);
    return new Response('Error generating analysis', { status: 500 });
  }
}
