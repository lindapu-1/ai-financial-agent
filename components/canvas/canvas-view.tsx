'use client';

import { Editor } from './editor';
import { AiSidebar } from './ai-sidebar';
import { Project } from '@/lib/db/schema';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

import { useProject } from '@/hooks/use-project';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import { useEffect } from 'react';

export function CanvasView() {
  const { activeProject, setActiveProject } = useProject();
  const params = useParams();

  const routeProjectIdRaw = params?.id;
  const routeProjectId =
    typeof routeProjectIdRaw === 'string'
      ? routeProjectIdRaw
      : Array.isArray(routeProjectIdRaw)
        ? routeProjectIdRaw[0]
        : null;

  // 兜底：当用户刷新/直接访问 /canvas/:id 时，从后端项目列表里同步 activeProject
  const { data: projects, isLoading: isProjectsLoading } = useSWR<Project[]>(
    routeProjectId ? '/api/projects' : null,
    fetcher,
    { fallbackData: [] },
  );

  useEffect(() => {
    if (!routeProjectId) return;
    if (activeProject?.id === routeProjectId) return;
    if (!projects) return;

    const matched = projects.find((p) => p.id === routeProjectId) ?? null;
    setActiveProject(matched);
  }, [routeProjectId, activeProject?.id, projects, setActiveProject]);

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
        <div className="text-4xl">📂</div>
        {routeProjectId && isProjectsLoading ? (
          <p>正在加载项目...</p>
        ) : routeProjectId ? (
          <p>未找到该项目（或无权限访问）</p>
        ) : (
          <p>请在左侧选择或创建一个项目开始</p>
        )}
      </div>
    );
  }

  return (
    // 关键：约束 Canvas 工作区高度（减去顶部 GlobalHeader 的 48px = 3rem）
    // 否则内容会把页面整体撑高，导致左右两栏“看起来一起滚动”
    <div className="flex h-[calc(100svh-3rem)] w-full min-h-0 overflow-hidden bg-background">
      <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
        {/* 中间：编辑器 */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col min-w-0 min-h-0 border-r">
            {/* 使用 key 强制重新渲染，确保切换 project 时立即更新（修复问题2） */}
            <Editor key={activeProject.id} project={activeProject} />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 右侧：AI 助手 */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col shrink-0 min-h-0">
            {/* 关键：项目切换时 remount，确保 useChat / 消息历史完全按新项目重置 */}
            <AiSidebar key={activeProject.id} project={activeProject} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
