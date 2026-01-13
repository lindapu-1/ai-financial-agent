'use client';

import { useState } from 'react';
import { Editor } from './editor';
import { AiSidebar } from './ai-sidebar';
import { Project } from '@/lib/db/schema';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

import { useProject } from '@/hooks/use-project';

export function CanvasView() {
  const { activeProject } = useProject();

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
        <div className="text-4xl">📂</div>
        <p>请在左侧选择或创建一个项目开始</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <ResizablePanelGroup direction="horizontal">
        {/* 中间：编辑器 */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col min-w-0 border-r">
            <Editor project={activeProject} />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 右侧：AI 助手 */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col shrink-0">
            <AiSidebar project={activeProject} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
