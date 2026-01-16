import { auth } from '@/app/(auth)/auth';
import {
  getPortfoliosByUserId,
  createPortfolio,
  getPortfolioById,
  getStocksByPortfolioId,
} from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';

export async function GET() {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const portfolios = await getPortfoliosByUserId({ userId: session.user.id });

  // Get stocks for each portfolio
  const portfoliosWithStocks = await Promise.all(
    portfolios.map(async (portfolio) => {
      const stocks = await getStocksByPortfolioId({ portfolioId: portfolio.id });
      return {
        ...portfolio,
        stocks: stocks.map((s) => s.ticker),
      };
    })
  );

  return Response.json(portfoliosWithStocks);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { name, stocks }: { name: string; stocks?: string[] } = await request.json();

  if (!name) {
    return new Response('Name is required', { status: 400 });
  }

  const id = generateUUID();
  await createPortfolio({
    id,
    name,
    userId: session.user.id,
  });

  // Add stocks if provided
  if (stocks && stocks.length > 0) {
    const { addStockToPortfolio } = await import('@/lib/db/queries');
    for (const ticker of stocks) {
      await addStockToPortfolio({ portfolioId: id, ticker });
    }
  }

  const portfolio = await getPortfolioById({ id });
  const portfolioStocks = await getStocksByPortfolioId({ portfolioId: id });

  return Response.json({
    ...portfolio,
    stocks: portfolioStocks.map((s) => s.ticker),
  });
}
