import { auth } from '@/app/(auth)/auth';
import {
  getPortfolioById,
  getStocksByPortfolioId,
} from '@/lib/db/queries';

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
      news: [],
      tickers: [],
    });
  }

  const tickers = stocks.map((s) => s.ticker);
  
  // Debug: Log tickers being fetched
  console.log(`[News API] Fetching news for portfolio ${id}, tickers:`, tickers);
  const financialDatasetsApiKey = process.env.FINANCIAL_DATASETS_API_KEY;

  if (isPlaceholderKey(financialDatasetsApiKey)) {
    return new Response('Financial Datasets API key is required', { status: 400 });
  }

  // Fetch news for each stock
  const newsPromises = tickers.map(async (ticker) => {
    try {
      const newsResponse = await fetch(
        `https://api.financialdatasets.ai/news/?ticker=${ticker}&limit=10`,
        {
          headers: {
            'X-API-Key': financialDatasetsApiKey!,
          },
        }
      );

      if (!newsResponse.ok) {
        const errorText = await newsResponse.text();
        console.error(`Error fetching news for ${ticker}: ${newsResponse.status} ${errorText}`);
        return {
          ticker,
          news: [],
        };
      }

      const newsData = await newsResponse.json();
      
      // Handle different response formats
      let newsArray: any[] = [];
      if (Array.isArray(newsData)) {
        newsArray = newsData;
      } else if (newsData && typeof newsData === 'object') {
        // If the API returns an object with a 'news' or 'data' property
        if (Array.isArray(newsData.news)) {
          newsArray = newsData.news;
        } else if (Array.isArray(newsData.data)) {
          newsArray = newsData.data;
        } else if (Array.isArray(newsData.results)) {
          newsArray = newsData.results;
        }
      }

      return {
        ticker,
        news: newsArray,
      };
    } catch (error) {
      console.error(`Error fetching news for ${ticker}:`, error);
      return {
        ticker,
        news: [],
      };
    }
  });

  const newsByTicker = await Promise.all(newsPromises);

  // Combine all news and sort by date
  const allNews = newsByTicker.flatMap((item) =>
    item.news.map((article: any) => ({
      ...article,
      ticker: item.ticker,
    }))
  );

  // Sort by date (newest first)
  allNews.sort((a, b) => {
    const dateA = new Date(a.date || a.published_at || 0).getTime();
    const dateB = new Date(b.date || b.published_at || 0).getTime();
    return dateB - dateA;
  });

  return Response.json({
    news: allNews,
    tickers,
  });
}
