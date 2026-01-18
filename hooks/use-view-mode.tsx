'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export type ViewMode = 'general' | 'canvas' | 'portfolio';

interface ViewModeContextType {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<ViewMode>('general');

  // 根据当前路径自动同步模式
  useEffect(() => {
    if (pathname.startsWith('/canvas')) {
      setMode('canvas');
    } else if (pathname.startsWith('/portfolio')) {
      setMode('portfolio');
    } else if (pathname.startsWith('/general') || pathname === '/') {
      setMode('general');
    }
  }, [pathname]);

  return (
    <ViewModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (context === undefined) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  return context;
}
