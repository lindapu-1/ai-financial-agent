'use client';

import { Project } from '@/lib/db/schema';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useDebounceCallback } from 'usehooks-ts';
import { updateProjectContent } from '@/app/(chat)/actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PaperclipIcon } from '@/components/icons';

interface EditorProps {
  project: Project | null;
}

export function Editor({ project }: EditorProps) {
  const [content, setContent] = useState(project?.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = useCallback(async (file: File) => {
    const fileName = file.name.toLowerCase();
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    // 支持PDF和Word文档 - 使用前端库解析
    if (fileName.endsWith('.pdf') || fileName.endsWith('.docx')) {
      try {
        toast.loading(`正在解析文件: ${file.name}...`, { id: 'file-upload' });
        
        let extractedText = '';
        
        // 解析PDF文件 - 使用pdf.js
        if (fileName.endsWith('.pdf')) {
          // 动态加载pdf.js
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
          
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n\n';
          }
          extractedText = fullText;
        }
        // 解析Word文档 - 使用mammoth.js
        else if (fileName.endsWith('.docx')) {
          // 动态加载mammoth
          const mammoth = await import('mammoth');
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          extractedText = result.value;
          
          if (result.messages.length > 0) {
            console.warn('Word document parsing warnings:', result.messages);
          }
        }
        
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('文件内容为空或无法提取文本');
        }
        
        const newContent = content ? `${content}\n\n${extractedText}` : extractedText;
        setContent(newContent);
        
        // 使用setTimeout确保DOM更新后再调整高度
        setTimeout(() => {
          adjustHeight();
        }, 0);
        
        debouncedSave(newContent);
        toast.success(`已加载文件: ${file.name}`, { id: 'file-upload' });
      } catch (error) {
        console.error('File upload error:', error);
        toast.error(
          error instanceof Error ? error.message : '读取文件失败',
          { id: 'file-upload' }
        );
      }
    }
    // 支持文本文件（.txt, .md, .json等）
    else if (['.txt', '.md', '.json', '.csv', '.log'].includes(fileExtension)) {
      try {
        const text = await file.text();
        const newContent = content ? `${content}\n\n${text}` : text;
        setContent(newContent);
        // 使用setTimeout确保DOM更新后再调整高度
        setTimeout(() => {
          adjustHeight();
        }, 0);
        debouncedSave(newContent);
        toast.success(`已加载文件: ${file.name}`);
      } catch (error) {
        console.error('File upload error:', error);
        toast.error('读取文件失败');
      }
    } else {
      toast.error('仅支持PDF、Word文档（.pdf, .docx）和文本文件（.txt, .md, .json, .csv, .log）');
    }
  }, [content, debouncedSave]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      files.forEach(handleFileUpload);
      // 重置input，允许重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFileUpload]
  );

  if (!project) return null;

  const charCount = content.length;
  const isOverLimit = charCount > MAX_RECOMMENDED_CHARS;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain bg-background/50 custom-scrollbar">
      {/* 标题栏 - 固定在编辑区域最顶部 */}
      <div className="flex items-center justify-between border-b border-border/50 pb-6 px-8 pt-8 sticky top-0 bg-background/95 backdrop-blur-md z-20">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
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
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.docx,.txt,.md,.json,.csv,.log"
              className="hidden"
              multiple
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs"
            >
              <PaperclipIcon size={14} className="mr-2" />
              上传文件
            </Button>
          </div>
        </div>
      </div>
      {/* 内容区域 */}
      <div className="flex-1 min-h-0 px-8 pb-8">
        <div className="max-w-4xl mx-auto w-full">
          <textarea
            ref={textareaRef}
            className="w-full min-h-[700px] bg-transparent outline-none resize-none text-lg leading-relaxed mt-8 pb-32 text-foreground/90 placeholder:text-muted-foreground/30 selection:bg-primary/20 transition-all duration-200"
            placeholder="在此处粘贴项目背景、行业报告、上下文等信息... 或点击右上角上传文件。AI 将基于此处内容进行回答。"
            value={content}
            onChange={handleChange}
            style={{ overflow: 'hidden' }}
          />
        </div>
      </div>
    </div>
  );
}
