'use client';

import { useViewMode } from '@/hooks/use-view-mode';
import { Chat } from './chat';
import { CanvasView } from './canvas/canvas-view';
import { Message } from 'ai';

interface MainContainerProps {
  id: string;
  selectedModelId: string;
  initialMessages?: Message[];
}

export function MainContainer({ id, selectedModelId, initialMessages = [] }: MainContainerProps) {
  const { mode } = useViewMode();

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Chat Mode */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${mode === 'chat' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
        <Chat
          id={id}
          initialMessages={initialMessages}
          selectedModelId={selectedModelId}
          selectedVisibilityType="private"
          isReadonly={false}
        />
      </div>

      {/* Canvas Mode */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${mode === 'canvas' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
        <CanvasView />
      </div>
    </div>
  );
}
