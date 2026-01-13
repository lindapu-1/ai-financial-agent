'use client';

import { Project } from '@/lib/db/schema';
import { useState, useEffect, useRef } from 'react';
import { useDebounceCallback } from 'usehooks-ts';
import { updateProjectContent } from '@/app/(chat)/actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EditorProps {
  project: Project | null;
}

export function Editor({ project }: EditorProps) {
  const [content, setContent] = useState(project?.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 建议的上限（对应 GPT-4o / DeepSeek 的 128k token，大约 40-50 万字符）
  const MAX_RECOMMENDED_CHARS = 400000;

  // 自动调整 textarea 高度
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // 当 project 切换或内容改变时，重置内容并调整高度
  useEffect(() => {
    setContent(project?.content || '');
    // 需要在 DOM 更新后调整高度
    setTimeout(adjustHeight, 0);
  }, [project?.id, project?.content]);

  // 防抖保存
  const debouncedSave = useDebounceCallback(async (newContent: string) => {
    if (!project) return;
    
    setIsSaving(true);
    try {
      await updateProjectContent({ id: project.id, content: newContent });
    } catch (error) {
      toast.error('保存失败，内容可能过大');
    } finally {
      setIsSaving(false);
    }
  }, 1000);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    adjustHeight();
    debouncedSave(newContent);
  };

  if (!project) return null;

  const charCount = content.length;
  const isOverLimit = charCount > MAX_RECOMMENDED_CHARS;

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-background/50 custom-scrollbar">
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-6 sticky top-0 bg-background/80 backdrop-blur-md z-10 -mx-2 px-2">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground/80">
              <span className={cn(
                "font-medium px-2 py-0.5 rounded bg-muted/50",
                isOverLimit && "text-destructive bg-destructive/10"
              )}>
                Characters: {charCount.toLocaleString()} / {MAX_RECOMMENDED_CHARS.toLocaleString()} Recommended
              </span>
              {isSaving && (
                <span className="animate-pulse flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Auto-saving...
                </span>
              )}
            </div>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className="w-full min-h-[700px] bg-transparent outline-none resize-none text-lg leading-relaxed mt-8 pb-32 text-foreground/90 placeholder:text-muted-foreground/30 selection:bg-primary/20 transition-all duration-200"
          placeholder="在此处粘贴项目背景、行业报告、上下文等信息... AI 将基于此处内容进行回答。"
          value={content}
          onChange={handleChange}
          style={{ overflow: 'hidden' }}
        />
      </div>
    </div>
  );
}
