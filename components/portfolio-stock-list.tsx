'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';
import { cn, fetcher } from '@/lib/utils';
import { PlusIcon, TrashIcon } from './icons';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface Portfolio {
  id: string;
  name: string;
  stocks: string[];
  createdAt: string;
  updatedAt: string;
}

export function PortfolioStockList() {
  const { data: portfolios, isLoading, mutate: mutatePortfolios } = useSWR<Portfolio[]>(
    '/api/portfolio',
    fetcher,
    {
      fallbackData: [],
    }
  );

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [selectedStockTicker, setSelectedStockTicker] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newStockTicker, setNewStockTicker] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const hasCreatedDefault = useRef(false);

  const selectedPortfolio = portfolios?.find((p) => p.id === selectedPortfolioId);

  // Auto-select first portfolio or create default one
  useEffect(() => {
    if (!isLoading && portfolios) {
      if (portfolios.length > 0 && !selectedPortfolioId) {
        const firstPortfolioId = portfolios[0].id;
        setSelectedPortfolioId(firstPortfolioId);
        // Dispatch custom event for PortfolioView to listen
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('portfolioSelected', { detail: { portfolioId: firstPortfolioId } })
          );
        }
      } else if (portfolios.length === 0 && !hasCreatedDefault.current) {
        hasCreatedDefault.current = true;
        createDefaultPortfolio();
      }
    }
  }, [portfolios, isLoading, selectedPortfolioId]);

  // Auto-select first stock when portfolio is selected
  useEffect(() => {
    if (selectedPortfolio && selectedPortfolio.stocks.length > 0 && !selectedStockTicker) {
      const firstStock = selectedPortfolio.stocks[0];
      setSelectedStockTicker(firstStock);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('stockSelected', { detail: { ticker: firstStock } })
        );
      }
    }
  }, [selectedPortfolio, selectedStockTicker]);

  const handleStockClick = (ticker: string) => {
    setSelectedStockTicker(ticker);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('stockSelected', { detail: { ticker } })
      );
    }
  };

  const createDefaultPortfolio = async () => {
    try {
      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Default Portfolio',
          stocks: ['AAPL', 'NVDA', 'GOOGL'],
        }),
      });
      if (response.ok) {
        const portfolio = await response.json();
        setSelectedPortfolioId(portfolio.id);
        // Dispatch custom event for PortfolioView to listen
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('portfolioSelected', { detail: { portfolioId: portfolio.id } })
          );
        }
        mutatePortfolios();
      }
    } catch (error) {
      console.error('Error creating default portfolio:', error);
    }
  };

  const handleAddStock = async () => {
    if (!newStockTicker.trim()) {
      toast.error('Please enter a stock ticker');
      return;
    }

    if (!selectedPortfolioId) {
      toast.error('No portfolio selected. Please wait for portfolio to load.');
      return;
    }

    if (isAdding) {
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch(`/api/portfolio/${selectedPortfolioId}/stocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: newStockTicker.trim().toUpperCase() }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', response.status, errorText);
        toast.error(`Failed to add stock: ${response.status} ${errorText}`);
        return;
      }

      const data = await response.json();
      setNewStockTicker('');
      setIsAddDialogOpen(false);
      mutatePortfolios();
      toast.success('Stock added successfully');
      
      // Trigger event for PortfolioView to refresh news
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('portfolioStocksUpdated', { detail: { portfolioId: selectedPortfolioId } })
        );
      }
    } catch (error) {
      console.error('Error adding stock:', error);
      toast.error(`Failed to add stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveStock = async (e: React.MouseEvent, ticker: string) => {
    e.stopPropagation();
    if (!selectedPortfolioId) return;

    try {
      const response = await fetch(
        `/api/portfolio/${selectedPortfolioId}/stocks?ticker=${ticker}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        mutatePortfolios();
        toast.success('Stock removed');
      } else {
        toast.error('Failed to remove stock');
      }
    } catch (error) {
      console.error('Error removing stock:', error);
      toast.error('Failed to remove stock');
    }
  };

  // Stock name mapping
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

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Portfolio Company
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                if (selectedPortfolioId) {
                  setIsAddDialogOpen(true);
                } else {
                  toast.error('Please wait for portfolio to load');
                }
              }}
              disabled={!selectedPortfolioId}
            >
              <PlusIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {selectedPortfolioId ? 'Add Stock' : 'Loading portfolio...'}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-1">
        {isLoading ? (
          <div className="px-2 py-4 text-xs text-muted-foreground text-center animate-pulse">
            Loading...
          </div>
        ) : !selectedPortfolio || selectedPortfolio.stocks.length === 0 ? (
          <div className="px-2 py-4 text-xs text-muted-foreground text-center italic">
            No stocks yet
          </div>
        ) : (
          selectedPortfolio.stocks.map((ticker) => (
            <div
              key={ticker}
              onClick={() => handleStockClick(ticker)}
              className={cn(
                'group flex items-center justify-between w-full px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer',
                selectedStockTicker === ticker
                  ? 'bg-sidebar-accent text-foreground'
                  : 'hover:bg-sidebar-accent/50 text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="truncate flex-1">{getStockName(ticker)}</span>
              <button
                onClick={(e) => handleRemoveStock(e, ticker)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
              >
                <TrashIcon size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stock to Portfolio</DialogTitle>
            <DialogDescription>Enter the stock ticker symbol to add.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="ticker" className="text-right">
                Ticker
              </Label>
              <Input
                id="ticker"
                value={newStockTicker}
                onChange={(e) => setNewStockTicker(e.target.value)}
                className="col-span-3"
                placeholder="e.g. AAPL"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && selectedPortfolioId) handleAddStock();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddStock} 
              disabled={isAdding || !selectedPortfolioId}
            >
              {isAdding ? 'Adding...' : 'Add Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
