import { auth } from '@/app/(auth)/auth';
import {
  getPortfolioById,
  addStockToPortfolio,
  removeStockFromPortfolio,
  getStocksByPortfolioId,
} from '@/lib/db/queries';

export async function POST(
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

  const { ticker }: { ticker: string } = await request.json();

  if (!ticker) {
    return new Response('Ticker is required', { status: 400 });
  }

  await addStockToPortfolio({ portfolioId: id, ticker });

  const stocks = await getStocksByPortfolioId({ portfolioId: id });

  return Response.json({
    stocks: stocks.map((s) => s.ticker),
  });
}

export async function DELETE(
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

  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return new Response('Ticker is required', { status: 400 });
  }

  await removeStockFromPortfolio({ portfolioId: id, ticker });

  const stocks = await getStocksByPortfolioId({ portfolioId: id });

  return Response.json({
    stocks: stocks.map((s) => s.ticker),
  });
}
