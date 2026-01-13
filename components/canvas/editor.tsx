'use client';

import { Project } from '@/lib/db/schema';
import { useState, useEffect, useCallback } from 'react';
import { useDebounceCallback } from 'usehooks-ts';
import { updateProjectContent } from '@/app/(chat)/actions';
import { toast } from 'sonner';

interface EditorProps {
  project: Project | null;
}

export function Editor({ project }: EditorProps) {
  const [content, setContent] = useState(project?.content || '');
  const [isSaving, setIsSaving] = useState(false);

  // 当 project 切换时，重置内容
  useEffect(() => {
    setContent(project?.content || '');
  }, [project?.id, project?.content]);

  // 防抖保存
  const debouncedSave = useDebounceCallback(async (newContent: string) => {
    if (!project) return;
    
    setIsSaving(true);
    try {
      await updateProjectContent({ id: project.id, content: newContent });
    } catch (error) {
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  }, 1000);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    debouncedSave(newContent);
  };

  if (!project) return null;

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-4">
        <div className="flex items-center justify-between border-b pb-4">
          <h1 className="text-3xl font-bold">{project.name}</h1>
          {isSaving && (
            <span className="text-xs text-muted-foreground animate-pulse italic">
              Saving...
            </span>
          )}
        </div>
        <textarea
          className="w-full min-h-[500px] bg-transparent outline-none resize-none text-lg leading-relaxed mt-4"
          placeholder="在此处粘贴项目背景、行业报告、上下文等信息... AI 将基于此处内容进行回答。"
          value={content}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
