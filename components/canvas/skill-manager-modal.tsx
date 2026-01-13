'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Skill } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PlusIcon, TrashIcon } from '@/components/icons';
import { saveSkill, updateSkill, deleteSkillById } from '@/app/(chat)/actions';
import { cn } from '@/lib/utils';

interface SkillManagerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkillManagerModal({
  isOpen,
  onOpenChange,
}: SkillManagerModalProps) {
  const { data: skills, mutate, isLoading } = useSWR<Skill[]>('/api/skills', fetcher, {
    fallbackData: [],
  });

  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 默认选中第一个
  useEffect(() => {
    if (skills && skills.length > 0 && !selectedSkill) {
      handleSelectSkill(skills[0]);
    }
  }, [skills, selectedSkill]);

  const handleSelectSkill = (skill: Skill) => {
    setSelectedSkill(skill);
    setEditName(skill.name);
    setEditPrompt(skill.prompt);
  };

  const handleCreateNew = () => {
    const newSkill: Partial<Skill> = {
      id: crypto.randomUUID(),
      name: '新技能',
      prompt: '在这里输入 AI 的提示词...',
    };
    setSelectedSkill(newSkill as Skill);
    setEditName(newSkill.name!);
    setEditPrompt(newSkill.prompt!);
  };

  const handleSave = async () => {
    if (!selectedSkill) return;
    setIsSaving(true);
    try {
      const isNew = !skills?.find((s) => s.id === selectedSkill.id);
      if (isNew) {
        await saveSkill({
          id: selectedSkill.id,
          name: editName,
          prompt: editPrompt,
        });
      } else {
        await updateSkill({
          id: selectedSkill.id,
          name: editName,
          prompt: editPrompt,
        });
      }
      await mutate();
      toast.success('Skill 已保存');
    } catch (error) {
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个 Skill 吗？')) return;
    try {
      await deleteSkillById({ id });
      await mutate();
      if (selectedSkill?.id === id) {
        setSelectedSkill(null);
      }
      toast.success('Skill 已删除');
    } catch (error) {
      toast.error('删除失败');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>管理研究技能 (Skills)</span>
            <Button size="sm" variant="outline" onClick={handleCreateNew}>
              <PlusIcon className="mr-2 h-4 w-4" /> 新增技能
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* 左侧列表 1/5 */}
          <div className="w-1/5 border-r bg-muted/20 flex flex-col overflow-y-auto">
            {skills?.map((skill) => (
              <div
                key={skill.id}
                onClick={() => handleSelectSkill(skill)}
                className={cn(
                  'px-4 py-3 text-sm cursor-pointer border-b transition-colors flex items-center justify-between group',
                  selectedSkill?.id === skill.id
                    ? 'bg-background border-r-2 border-r-primary font-medium'
                    : 'hover:bg-muted/50 text-muted-foreground'
                )}
              >
                <span className="truncate">{skill.name}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(skill.id); }}
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            ))}
            {skills?.length === 0 && !selectedSkill && (
              <div className="p-4 text-xs text-muted-foreground text-center italic">
                点击上方新增技能
              </div>
            )}
          </div>

          {/* 右侧编辑区域 4/5 */}
          <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
            {selectedSkill ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">技能名称</label>
                  <Input 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)} 
                    placeholder="如：行业情况分析"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-2 min-h-0">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">系统提示词 (Prompt)</label>
                  <Textarea 
                    className="flex-1 font-mono text-sm leading-relaxed resize-none"
                    value={editPrompt} 
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="请输入该技能对应的 AI 指令..."
                  />
                  <p className="text-[11px] text-muted-foreground italic">
                    提示：AI 会自动将编辑器中的内容作为上下文。你只需要定义如何处理这些内容。
                  </p>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? '保存中...' : '保存更改'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                请在左侧选择一个技能或点击新增
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
