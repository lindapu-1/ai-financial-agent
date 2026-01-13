'use client';

import { Project } from '@/lib/db/schema';
import { ModelSelector } from '../model-selector';
import { useState, useEffect } from 'react';
import { DEFAULT_MODEL_NAME } from '@/lib/ai/models';
import { useChat } from 'ai/react';
import { Messages } from '../messages';
import { MultimodalInput } from '../multimodal-input';
import { useSWRConfig } from 'swr';
import { getLocalOpenAIApiKey } from '@/lib/db/api-keys';
import { Attachment } from 'ai';
import { SkillManagerModal } from './skill-manager-modal';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import { Skill } from '@/lib/db/schema';

interface AiSidebarProps {
  project: Project | null;
}

export function AiSidebar({ project }: AiSidebarProps) {
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_NAME);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const { mutate } = useSWRConfig();
  const modelApiKey = getLocalOpenAIApiKey();
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);

  // 获取数据库中的 Skills
  const { data: skills, mutate: mutateSkills } = useSWR<Skill[]>('/api/skills', fetcher, {
    fallbackData: [],
  });

  // 当 Modal 关闭时，手动刷新技能列表
  const [prevIsModalOpen, setPrevIsModalOpen] = useState(false);
  useEffect(() => {
    if (prevIsModalOpen && !isSkillModalOpen) {
      mutateSkills();
    }
    setPrevIsModalOpen(isSkillModalOpen);
  }, [isSkillModalOpen, prevIsModalOpen, mutateSkills]);

  // Canvas 模式下的对话 ID：直接使用项目 ID (确保是标准 UUID)
  const chatId = project ? project.id : '00000000-0000-0000-0000-000000000000';

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    isLoading,
    stop,
    reload,
  } = useChat({
    id: chatId,
    body: {
      id: chatId,
      modelId: selectedModelId,
      modelApiKey,
      mode: 'canvas',
      projectId: project?.id,
      skillId: activeSkillId,
    },
    onFinish: () => {
      mutate('/api/history');
    },
  });

  // 当切换项目时，清除当前消息
  useEffect(() => {
    if (project) {
      setMessages([]); 
      setAttachments([]);
    }
  }, [project?.id, setMessages]);

  return (
    <div className="flex flex-col h-full bg-background border-l relative">
      {/* 顶部：模型选择 */}
      <div className="p-3 border-b flex items-center justify-between gap-2 shrink-0">
        <ModelSelector 
          selectedModelId={selectedModelId} 
          onSelectModel={setSelectedModelId} 
        />
      </div>

      {/* 消息区域 */}
      <div className="flex-1 overflow-hidden relative">
        {!project ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8">
            <p className="text-sm">请先选择一个项目开始对话</p>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <Messages
              chatId={chatId}
              isLoading={isLoading}
              messages={messages}
              setMessages={setMessages}
              reload={reload}
              isReadonly={false}
              isBlockVisible={false}
            />
          </div>
        )}
      </div>

      {/* 输入框区域 */}
      <div className="p-4 border-t shrink-0 bg-background">
        {/* 技能栏 - 增大尺寸和字号 */}
        <div className="flex items-center gap-3 mb-4 bg-muted/30 p-2 rounded-xl">
          <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar py-0.5">
            {skills?.map((skill) => (
              <button
                key={skill.id}
                onClick={() =>
                  setActiveSkillId(activeSkillId === skill.id ? null : skill.id)
                }
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-all border shadow-sm ${
                  activeSkillId === skill.id
                    ? 'bg-primary text-primary-foreground border-primary scale-105'
                    : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground border-input hover:border-muted-foreground/30'
                }`}
              >
                {skill.name}
              </button>
            ))}
          </div>
          <div className="h-4 w-[1px] bg-border mx-1 shrink-0" />
          <button
            onClick={() => setIsSkillModalOpen(true)}
            className="text-[12px] font-medium text-muted-foreground hover:text-primary transition-colors hover:underline underline-offset-4 shrink-0 px-2"
          >
            自定义
          </button>
        </div>

        <MultimodalInput
          chatId={chatId}
          input={input}
          setInput={setInput}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          stop={stop}
          attachments={attachments}
          setAttachments={setAttachments}
          messages={messages}
          setMessages={setMessages}
          append={append}
          showSuggestedActions={false}
        />
      </div>

      <SkillManagerModal
        isOpen={isSkillModalOpen}
        onOpenChange={setIsSkillModalOpen}
      />
    </div>
  );
}
