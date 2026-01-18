'use client';

import { useViewMode } from '@/hooks/use-view-mode';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import Link from 'next/link';
import { SidebarTrigger } from './ui/sidebar';

export function GlobalHeader() {
  const { mode, setMode } = useViewMode();

  return (
    <header className="flex items-center justify-between px-4 h-12 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1 mr-2" />
        <Link
          href="/general"
          className="flex items-center"
        >
          <span className="text-lg font-bold text-primary tracking-tight">
            Hony Capital
          </span>
        </Link>
      </div>

      <div className="flex bg-muted rounded-lg p-1 scale-90">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn(
            "px-6 h-7 rounded-md transition-all text-xs",
            mode === 'general' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          )}
        >
          <Link href="/general">
            General
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn(
            "px-6 h-7 rounded-md transition-all text-xs",
            mode === 'canvas' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          )}
        >
          <Link href="/canvas">
            Canvas
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn(
            "px-6 h-7 rounded-md transition-all text-xs",
            mode === 'portfolio' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          )}
        >
          <Link href="/portfolio">
            Portfolio
          </Link>
        </Button>
      </div>

      <div className="w-[140px]" /> {/* Spacer to balance the logo width */}
    </header>
  );
}
