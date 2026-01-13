'use client';

import { Project } from '@/lib/db/schema';
import { ModelSelector } from '../model-selector';
import { useState } from 'react';
import { DEFAULT_MODEL_NAME } from '@/lib/ai/models';

interface AiSidebarProps {
  project: Project | null;
}

export function AiSidebar({ project }: AiSidebarProps) {
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_NAME);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);

  const skills = [
    { id: 'industry', name: '行业情况' },
    { id: 'barrier', name: '技术壁垒' }
  ];

  return (
    <div className="flex flex-col h-full bg-background border-l">
      {/* 顶部：模型选择 */}
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <ModelSelector 
          selectedModelId={selectedModelId} 
          onSelectModel={setSelectedModelId} 
        />
      </div>

      {/* 技能栏 */}
      <div className="p-2 border-b flex gap-2 overflow-x-auto bg-muted/30">
        {skills.map(skill => (
          <button
            key={skill.id}
            onClick={() => setActiveSkill(activeSkill === skill.id ? null : skill.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeSkill === skill.id
                ? "bg-primary text-primary-foreground"
                : "bg-background border hover:bg-muted"
            }`}
          >
            {skill.name}
          </button>
        ))}
      </div>

      {/* 消息区域 (Placeholder) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!project ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8">
            <p className="text-sm">Please select a project to start chatting with AI.</p>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic">
            Start a new conversation about {project.name}...
          </div>
        )}
      </div>

      {/* 输入框区域 (Placeholder) */}
      <div className="p-4 border-t">
        <div className="bg-muted rounded-lg p-3 min-h-[80px] text-sm text-muted-foreground">
          AI Chat Input Placeholder
        </div>
      </div>
    </div>
  );
}
