import { Project } from '@/lib/db/schema';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDebounceCallback } from 'usehooks-ts';
import { updateProjectContent } from '@/app/(chat)/actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  PaperclipIcon, 
  FileTextIcon, 
  Loader2Icon, 
  XIcon, 
  FileIcon,
  Trash2Icon
} from 'lucide-react';

interface EditorProps {
  project: Project | null;
}

/**
 * 文件卡片组件 - 真正的 UI 渲染
 */
function VisualFileCard({ 
  name, 
  onRemove 
}: { 
  name: string; 
  onRemove: () => void 
}) {
  const extension = name.split('.').pop()?.toLowerCase();
  
  return (
    <div className="flex items-center justify-between w-full max-w-2xl bg-muted/30 border border-border/50 rounded-xl p-3 my-1 group hover:bg-muted/50 hover:border-primary/30 transition-all duration-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-background border border-border shadow-inner group-hover:scale-110 transition-transform">
          {extension === 'pdf' ? (
            <FileTextIcon className="text-red-500" size={20} />
          ) : extension === 'docx' ? (
            <FileTextIcon className="text-blue-500" size={20} />
          ) : (
            <FileIcon className="text-muted-foreground" size={20} />
          )}
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="font-medium text-foreground truncate max-w-[400px] text-sm">
            {name}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            {extension || 'unknown'} document
          </span>
        </div>
      </div>
      
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="opacity-0 group-hover:opacity-100 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
      >
        <Trash2Icon size={16} />
      </Button>
    </div>
  );
}

export function Editor({ project }: EditorProps) {
  const [content, setContent] = useState(project?.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevProjectIdRef = useRef<string | null>(null);

  const HIDDEN_DATA_SEPARATOR = '\n\n--- DO NOT EDIT BELOW THIS LINE ---\n';

  // 当 project 切换时，立即更新 content（修复问题2）
  useEffect(() => {
    if (project?.id !== prevProjectIdRef.current) {
      prevProjectIdRef.current = project?.id || null;
      // 立即更新 content，避免显示上一个 project 的内容
      setContent(project?.content || '');
    }
  }, [project?.id, project?.content]);

  // 解析内容为块
  const blocks = useMemo(() => {
    const displayPart = content.split(HIDDEN_DATA_SEPARATOR)[0];
    const parts = displayPart.split(/(\[FILE:[^\]]+\])/g);
    
    const parsedBlocks = parts.map((part, index) => {
      const fileMatch = part.match(/\[FILE:(.+)\]/);
      if (fileMatch) {
        // 使用文件名作为稳定的 ID，而不是 index
        return { id: `file-${fileMatch[1]}`, type: 'file' as const, fileName: fileMatch[1], raw: part };
      }
      return { id: `text-${index}`, type: 'text' as const, content: part, raw: part };
    });
    
    // 不过滤空白块，保留所有块以便正确渲染
    return parsedBlocks;
  }, [content]);
  
  // 获取文件下方输入框的内容（最后一个文件标记后的文本）
  const getTextAfterLastFile = useMemo(() => {
    const displayPart = content.split(HIDDEN_DATA_SEPARATOR)[0];
    const parts = displayPart.split(/(\[FILE:[^\]]+\])/g);
    
    // 找到最后一个文件标记的索引
    let lastFileIndex = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].match(/\[FILE:[^\]]+\]/)) {
        lastFileIndex = i;
        break;
      }
    }
    
    // 如果找到文件标记，返回它后面的所有文本
    if (lastFileIndex >= 0 && lastFileIndex < parts.length - 1) {
      return parts.slice(lastFileIndex + 1).join('');
    }
    
    return '';
  }, [content]);

  // 防抖保存
  const debouncedSave = useDebounceCallback(async (newContent: string) => {
    if (!project) return;
    setIsSaving(true);
    try {
      await updateProjectContent({ id: project.id, content: newContent });
    } catch (error) {
      console.error('保存项目内容失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      // 根据错误类型显示不同的提示
      if (errorMessage.includes('Unauthorized') || errorMessage.includes('未授权')) {
        toast.error('保存失败：请先登录', {
          description: '您的登录状态已过期，请刷新页面重新登录',
        });
      } else if (errorMessage.includes('too large') || errorMessage.includes('太大')) {
        toast.error('保存失败：内容过大', {
          description: '文件内容太大，请尝试删除一些文件或文本',
        });
      } else {
        toast.error('保存失败', {
          description: errorMessage.length > 50 ? `${errorMessage.substring(0, 50)}...` : errorMessage,
        });
      }
    } finally {
      setIsSaving(false);
    }
  }, 1000);

  // 删除文件卡片
  const removeFile = (fileName: string) => {
    const [visiblePart, hiddenPart] = content.split(HIDDEN_DATA_SEPARATOR);
    
    // 使用正则表达式匹配文件标记，包括前后的换行符
    // 转义文件名中的特殊字符（用于正则）
    const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fileTagRegex = new RegExp(`\\n?\\[FILE:${escapedFileName}\\]\\n?`, 'g');
    
    // 移除文件标记，并清理多余的连续换行符
    let newVisible = visiblePart.replace(fileTagRegex, '\n');
    // 清理连续的换行符（最多保留两个）
    newVisible = newVisible.replace(/\n{3,}/g, '\n\n');
    // 清理开头和结尾的换行符
    newVisible = newVisible.trim();
    
    // 从隐藏数据中移除文件内容
    let filesMap: Record<string, string> = {};
    try {
      if (hiddenPart) filesMap = JSON.parse(hiddenPart.trim());
    } catch (e) {
      console.error('解析隐藏数据失败:', e);
    }
    delete filesMap[fileName];
    
    const newHidden = Object.keys(filesMap).length > 0 ? JSON.stringify(filesMap) : '';
    const finalContent = newHidden ? newVisible + HIDDEN_DATA_SEPARATOR + newHidden : newVisible;
      
    setContent(finalContent);
    debouncedSave(finalContent);
    toast.success(`已移除文件: ${fileName}`);
  };

  // 更新文本块
  const updateTextBlock = (id: string, newText: string) => {
    const newVisible = blocks.map(b => {
      if (b.id === id) return newText;
      return b.raw;
    }).join('');

    const parts = content.split(HIDDEN_DATA_SEPARATOR);
    const hiddenPart = parts.length > 1 ? parts[1] : '';
    const finalContent = hiddenPart ? newVisible + HIDDEN_DATA_SEPARATOR + hiddenPart : newVisible;
    
    setContent(finalContent);
    debouncedSave(finalContent);
  };

  const handleFileUpload = useCallback(async (file: File) => {
    const fileName = file.name;
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    
    // 检查文件大小（警告但不阻止）
    if (file.size > 10 * 1024 * 1024) { // 10MB
      toast.warning(`文件较大 (${fileSizeMB}MB)，解析可能需要较长时间`, { id: 'file-upload-warning' });
    }
    
    try {
      toast.loading(`正在解析文件: ${fileName} (${fileSizeMB}MB)...`, { id: 'file-upload' });
      let extractedText = '';

      // --- 解析逻辑 ---
      const extension = fileName.toLowerCase().split('.').pop();
      if (extension === 'pdf') {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const items = textContent.items as any[];
          items.sort((a, b) => (Math.abs(a.transform[5] - b.transform[5]) < 5 ? a.transform[4] - b.transform[4] : b.transform[5] - a.transform[5]));
          let lastY = -1;
          for (const item of items) {
            if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) fullText += '\n';
            fullText += item.str + ' ';
            lastY = item.transform[5];
          }
          fullText += '\n\n';
        }
        extractedText = fullText.trim();
      } else if (extension === 'docx') {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        try {
          extractedText = (await mammoth.extractRawText({ arrayBuffer })).value;
        } catch (e) {
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(arrayBuffer);
          extractedText = (await zip.file('word/document.xml')?.async('string'))?.replace(/<w:p[^>]*>/g, '\n').replace(/<[^>]+>/g, '').trim() || '';
        }
      } else {
        extractedText = await file.text();
      }

      if (!extractedText) throw new Error('无法提取文本内容');

      // 检查提取的文本大小
      const extractedSizeMB = (new TextEncoder().encode(extractedText).length / (1024 * 1024)).toFixed(2);
      if (parseFloat(extractedSizeMB) > 20) {
        toast.warning(`提取的文本较大 (${extractedSizeMB}MB)，保存可能需要较长时间`, { id: 'file-upload-size-warning' });
      }

      // 更新隐藏数据
      const [visiblePart, hiddenPart] = content.split(HIDDEN_DATA_SEPARATOR);
      let filesMap: Record<string, string> = {};
      try {
        if (hiddenPart) filesMap = JSON.parse(hiddenPart.trim());
      } catch (e) {
        console.warn('解析隐藏数据失败，将创建新的文件映射:', e);
      }
      filesMap[fileName] = extractedText;
      
      const newHidden = JSON.stringify(filesMap);
      
      // 检查总内容大小
      const totalContent = visiblePart.trimEnd() + `\n[FILE:${fileName}]\n` + HIDDEN_DATA_SEPARATOR + newHidden;
      const totalSizeMB = (new TextEncoder().encode(totalContent).length / (1024 * 1024)).toFixed(2);
      
      if (parseFloat(totalSizeMB) > 50) {
        toast.error('内容过大，无法保存', {
          description: `总内容大小 ${totalSizeMB}MB 超过限制 (50MB)，请删除一些文件`,
          id: 'file-upload',
        });
        return;
      }
      
      // 优化插入换行符
      const fileTag = `\n[FILE:${fileName}]\n`;
      const finalContent = visiblePart.trimEnd() + fileTag + HIDDEN_DATA_SEPARATOR + newHidden;

      setContent(finalContent);
      toast.success(`已添加文件: ${fileName} (${extractedSizeMB}MB)`, { id: 'file-upload' });
      debouncedSave(finalContent);

    } catch (error) {
      toast.error('上传解析失败', { id: 'file-upload' });
    }
  }, [content, debouncedSave]);

  const handleUploadClick = () => fileInputRef.current?.click();

  if (!project) return null;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain bg-background custom-scrollbar">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between border-b border-border/40 pb-6 px-8 pt-8 sticky top-0 bg-background/95 backdrop-blur-md z-20">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground/90">{project.name}</h1>
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 font-medium">
              <span>Smart Document Editor</span>
              {isSaving && (
                <span className="flex items-center gap-1.5 text-primary animate-pulse">
                  <Loader2Icon size={12} className="animate-spin" />
                  Saving Changes
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => Array.from(e.target.files || []).forEach(handleFileUpload)}
              accept=".pdf,.docx,.txt,.md,.json,.csv,.log"
              className="hidden"
              multiple
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleUploadClick} 
              className="rounded-full px-4 h-9 bg-background hover:bg-muted border-border/60 transition-all hover:shadow-md"
            >
              <PaperclipIcon size={16} className="mr-2 text-primary" />
              上传文件
            </Button>
          </div>
        </div>
      </div>

      {/* 主编辑区 */}
      <div className="flex-1 min-h-0 px-8 pb-32">
        <div className="max-w-4xl mx-auto w-full pt-8 space-y-1">
          {blocks.map((block) => (
            block.type === 'file' ? (
              <VisualFileCard 
                key={block.id} 
                name={block.fileName || ''} 
                onRemove={() => block.fileName && removeFile(block.fileName)}
              />
            ) : (
              <AutoTextArea
                key={block.id}
                value={block.content || ''}
                onChange={(val) => updateTextBlock(block.id, val)}
                placeholder="在此处输入内容..."
              />
            )
          ))}
          
          {/* 如果最后一个块是文件，增加一个额外的输入区以便继续输入（修复问题1） */}
          {blocks[blocks.length - 1]?.type === 'file' && (
             <AutoTextArea
                key={`extra-bottom-${project?.id}`}
                value={getTextAfterLastFile}
                onChange={(val) => {
                  const parts = content.split(HIDDEN_DATA_SEPARATOR);
                  const visiblePart = parts[0] || '';
                  
                  // 找到最后一个文件标记的位置
                  const fileTagRegex = /\[FILE:[^\]]+\]/g;
                  const matches = [...visiblePart.matchAll(fileTagRegex)];
                  
                  if (matches.length > 0) {
                    // 找到最后一个文件标记的结束位置
                    const lastMatch = matches[matches.length - 1];
                    const lastFileEndIndex = lastMatch.index! + lastMatch[0].length;
                    
                    // 保留最后一个文件标记之前的内容，然后添加新输入的内容
                    const beforeLastFile = visiblePart.substring(0, lastFileEndIndex);
                    const newVisible = beforeLastFile + (visiblePart[lastFileEndIndex] === '\n' ? '' : '\n') + val;
                    
                    const finalContent = parts.length > 1 
                      ? newVisible + HIDDEN_DATA_SEPARATOR + parts[1] 
                      : newVisible;
                    setContent(finalContent);
                    debouncedSave(finalContent);
                  } else {
                    // 如果没有找到文件标记（不应该发生），直接追加
                    const newVisible = visiblePart + '\n' + val;
                    const finalContent = parts.length > 1 
                      ? newVisible + HIDDEN_DATA_SEPARATOR + parts[1] 
                      : newVisible;
                    setContent(finalContent);
                    debouncedSave(finalContent);
                  }
                }}
                placeholder="继续输入内容..."
             />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 自动增长的文本编辑区组件
 */
function AutoTextArea({ 
  value, 
  onChange, 
  placeholder 
}: { 
  value: string; 
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent outline-none resize-none text-lg leading-relaxed text-foreground/90 placeholder:text-muted-foreground/20 selection:bg-primary/20 transition-all duration-200 py-2 min-h-[50px] overflow-hidden"
      placeholder={placeholder}
      rows={1}
    />
  );
}
