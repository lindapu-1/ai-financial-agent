import { auth } from '@/app/(auth)/auth';
import {
  getPortfolioById,
  updatePortfolio,
  deletePortfolioById,
  getStocksByPortfolioId,
} from '@/lib/db/queries';

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

  return Response.json({
    ...portfolio,
    stocks: stocks.map((s) => s.ticker),
  });
}

export async function PATCH(
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

  const { name }: { name?: string } = await request.json();

  await updatePortfolio({ id, name });

  const updatedPortfolio = await getPortfolioById({ id });
  const stocks = await getStocksByPortfolioId({ portfolioId: id });

  return Response.json({
    ...updatedPortfolio,
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

  await deletePortfolioById({ id });

  return Response.json({ success: true });
}
