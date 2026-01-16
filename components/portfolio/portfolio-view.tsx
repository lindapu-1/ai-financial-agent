'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { fetcher } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isToday, isYesterday, startOfDay, subDays, differenceInDays } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface Portfolio {
  id: string;
  name: string;
  stocks: string[];
  createdAt: string;
  updatedAt: string;
}

interface NewsItem {
  ticker: string;
  title: string;
  headline?: string;
  author?: string;
  source?: string;
  date?: string;
  published_at?: string;
  url?: string;
  image_url?: string;
  summary?: string;
}

interface NewsResponse {
  news: NewsItem[];
  tickers: string[];
}

type NewsGroup = {
  label: string;
  news: NewsItem[];
};

export function PortfolioView() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [selectedStockTicker, setSelectedStockTicker] = useState<string | null>(null);

  // Get selected portfolio ID - listen for custom events from PortfolioStockList
  useEffect(() => {
    const handlePortfolioSelected = (event: Event) => {
      const customEvent = event as CustomEvent<{ portfolioId: string }>;
      setSelectedPortfolioId(customEvent.detail.portfolioId);
    };

    const handleStockSelected = (event: Event) => {
      const customEvent = event as CustomEvent<{ ticker: string }>;
      setSelectedStockTicker(customEvent.detail.ticker);
    };

    window.addEventListener('portfolioSelected', handlePortfolioSelected);
    window.addEventListener('stockSelected', handleStockSelected);
    return () => {
      window.removeEventListener('portfolioSelected', handlePortfolioSelected);
      window.removeEventListener('stockSelected', handleStockSelected);
    };
  }, []);

  const { data: portfolios } = useSWR<Portfolio[]>('/api/portfolio', fetcher);

  // Auto-select first portfolio if none selected
  useEffect(() => {
    if (portfolios && portfolios.length > 0 && !selectedPortfolioId) {
      setSelectedPortfolioId(portfolios[0].id);
    }
  }, [portfolios, selectedPortfolioId]);

  const selectedPortfolio = portfolios?.find((p) => p.id === selectedPortfolioId);

  const { data: newsData, isLoading: isNewsLoading, error: newsError, mutate: mutateNews } = useSWR<NewsResponse>(
    selectedPortfolioId ? `/api/portfolio/${selectedPortfolioId}/news` : null,
    fetcher,
    {
      refreshInterval: 300000, // Refresh every 5 minutes
    }
  );

  // Listen for portfolio stocks updated event to refresh news
  useEffect(() => {
    const handlePortfolioStocksUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ portfolioId: string }>;
      if (customEvent.detail.portfolioId === selectedPortfolioId) {
        mutateNews();
      }
    };

    window.addEventListener('portfolioStocksUpdated', handlePortfolioStocksUpdated);
    return () => {
      window.removeEventListener('portfolioStocksUpdated', handlePortfolioStocksUpdated);
    };
  }, [selectedPortfolioId, mutateNews]);

  // Filter and group news by time periods
  const groupedNews = useMemo(() => {
    if (!newsData || !newsData.news || newsData.news.length === 0) {
      return [];
    }

    // Filter news by selected stock ticker if one is selected
    let filteredNews = newsData.news;
    if (selectedStockTicker) {
      filteredNews = newsData.news.filter((article) => 
        article.ticker?.toUpperCase() === selectedStockTicker.toUpperCase()
      );
    }

    if (filteredNews.length === 0) {
      return [];
    }

    const now = new Date();
    const today = startOfDay(now);
    const sevenDaysAgo = startOfDay(subDays(now, 7));

    const groups: NewsGroup[] = [
      { label: 'Today', news: [] },
      { label: 'Past 7 Days', news: [] },
      { label: 'Earlier', news: [] },
    ];

    filteredNews.forEach((article) => {
      const articleDate = article.date || article.published_at;
      if (!articleDate) {
        groups[2].news.push(article); // Put in "Earlier" if no date
        return;
      }

      try {
        const date = new Date(articleDate);
        const articleDay = startOfDay(date);

        if (isToday(date)) {
          groups[0].news.push(article);
        } else if (date >= sevenDaysAgo) {
          groups[1].news.push(article);
        } else {
          groups[2].news.push(article);
        }
      } catch {
        groups[2].news.push(article);
      }
    });

    // Filter out empty groups
    return groups.filter((group) => group.news.length > 0);
  }, [newsData, selectedStockTicker]);

  const formatNewsDate = (dateString?: string) => {
    if (!dateString) return 'Date unknown';
    try {
      return format(new Date(dateString), 'MMM d, yyyy • h:mm a');
    } catch {
      return dateString;
    }
  };

  const getStockName = (ticker: string) => {
    const names: Record<string, string> = {
      AAPL: 'Apple',
      NVDA: 'Nvidia',
      GOOGL: 'Google',
      MSFT: 'Microsoft',
      TSLA: 'Tesla',
      AMZN: 'Amazon',
      META: 'Meta',
    };
    return names[ticker] || ticker;
  };

  const selectedStockName = selectedStockTicker ? getStockName(selectedStockTicker) : null;

  if (!selectedPortfolio) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Portfolio Selected</CardTitle>
            <CardDescription>Please select or create a portfolio to view.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex-1 flex flex-col p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">
            {selectedStockName || selectedPortfolio.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {selectedStockName
              ? `News for ${selectedStockName}`
              : `${selectedPortfolio.stocks.length} companies`}
          </p>
        </div>

        <ScrollArea className="flex-1">
          {isNewsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-32 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : newsError ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-destructive">
                  Error loading news. Please check your API configuration.
                </p>
              </CardContent>
            </Card>
          ) : groupedNews.length > 0 ? (
            <div className="space-y-6">
              {groupedNews.map((group, groupIndex) => (
                <div key={group.label}>
                  <div className="mb-3">
                    <h2 className="text-lg font-semibold text-foreground">{group.label}</h2>
                    <p className="text-xs text-muted-foreground">{group.news.length} articles</p>
                  </div>
                  <div className="space-y-3">
                    {group.news.map((article, index) => (
                      <Card key={index} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            {article.image_url && (
                              <div className="relative w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden">
                                <Image
                                  src={article.image_url}
                                  alt={article.title || article.headline || ''}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-primary">
                                  {getStockName(article.ticker)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatNewsDate(article.date || article.published_at)}
                                </span>
                                {article.source && (
                                  <span className="text-xs text-muted-foreground">
                                    • {article.source}
                                  </span>
                                )}
                              </div>
                              {article.url ? (
                                <Link
                                  href={article.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block"
                                >
                                  <h3 className="text-lg font-semibold mb-2 hover:text-primary transition-colors line-clamp-2">
                                    {article.title || article.headline}
                                  </h3>
                                </Link>
                              ) : (
                                <h3 className="text-lg font-semibold mb-2 line-clamp-2">
                                  {article.title || article.headline}
                                </h3>
                              )}
                              {article.summary && (
                                <p className="text-sm text-muted-foreground line-clamp-3">
                                  {article.summary}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {groupIndex < groupedNews.length - 1 && (
                    <Separator className="my-6" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  No news available. This could be due to:
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li>API key not configured</li>
                  <li>No recent news for these stocks</li>
                  <li>Network connectivity issues</li>
                </ul>
              </CardContent>
            </Card>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
