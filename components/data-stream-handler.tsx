'use client';

import { useChat } from 'ai/react';
import { useEffect, useRef } from 'react';
import { BlockKind } from './block';
import { initialBlockData, useBlock } from '@/hooks/use-block';
import { useUserMessageId } from '@/hooks/use-user-message-id';
import { useToolLoading } from '@/hooks/use-tool-loading';
import { useQueryLoading } from '@/hooks/use-query-loading';
import { DataStreamDelta, ToolLoadingContent, QueryLoadingContent } from '@/lib/types/data-stream';

export function DataStreamHandler({ id }: { id: string }) {
  const { data: dataStream } = useChat({ id });
  const { setUserMessageIdFromServer } = useUserMessageId();
  const { setBlock } = useBlock();
  const { setToolLoading } = useToolLoading();
  const { setQueryLoading } = useQueryLoading();
  const lastProcessedIndex = useRef(-1);
  const processingRef = useRef(false);
  
  // 使用 ref 来稳定函数引用，避免 useEffect 依赖项变化
  const setUserMessageIdFromServerRef = useRef(setUserMessageIdFromServer);
  const setBlockRef = useRef(setBlock);
  const setToolLoadingRef = useRef(setToolLoading);
  const setQueryLoadingRef = useRef(setQueryLoading);
  
  // 更新 refs
  setUserMessageIdFromServerRef.current = setUserMessageIdFromServer;
  setBlockRef.current = setBlock;
  setToolLoadingRef.current = setToolLoading;
  setQueryLoadingRef.current = setQueryLoading;

  useEffect(() => {
    if (!dataStream?.length || processingRef.current) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    if (newDeltas.length === 0) return;

    processingRef.current = true;
    lastProcessedIndex.current = dataStream.length - 1;

    (newDeltas as DataStreamDelta[]).forEach((delta: DataStreamDelta) => {
      if (delta.type === 'user-message-id') {
        setUserMessageIdFromServerRef.current(delta.content as string);
        return;
      }

      if (delta.type === 'tool-loading') {
        const { tool, isLoading, message } = delta.content as ToolLoadingContent;
        setToolLoadingRef.current(tool as any, isLoading, message);
        return;
      }

      if (delta.type === 'query-loading') {
        const { isLoading, taskNames } = delta.content as QueryLoadingContent;
        // setQueryLoading 内部已经有状态比较，不会重复更新
        setQueryLoadingRef.current(isLoading, taskNames || []);
        return;
      }

      setBlockRef.current((draftBlock) => {
        if (!draftBlock) {
          return { ...initialBlockData, status: 'streaming' };
        }

        switch (delta.type) {
          case 'id':
            return {
              ...draftBlock,
              documentId: delta.content as string,
              status: 'streaming',
            };

          case 'title':
            return {
              ...draftBlock,
              title: delta.content as string,
              status: 'streaming',
            };

          case 'kind':
            return {
              ...draftBlock,
              kind: delta.content as BlockKind,
              status: 'streaming',
            };

          case 'text-delta':
            return {
              ...draftBlock,
              content: draftBlock.content + (delta.content as string),
              isVisible:
                draftBlock.status === 'streaming' &&
                draftBlock.content.length > 400 &&
                draftBlock.content.length < 450
                  ? true
                  : draftBlock.isVisible,
              status: 'streaming',
            };

          case 'code-delta':
            return {
              ...draftBlock,
              content: delta.content as string,
              isVisible:
                draftBlock.status === 'streaming' &&
                draftBlock.content.length > 300 &&
                draftBlock.content.length < 310
                  ? true
                  : draftBlock.isVisible,
              status: 'streaming',
            };

          case 'clear':
            return {
              ...draftBlock,
              content: '',
              status: 'streaming',
            };

          case 'finish':
            return {
              ...draftBlock,
              status: 'idle',
            };

          default:
            return draftBlock;
        }
      });
    });

    // 使用 setTimeout 确保在处理完所有 deltas 后再重置处理锁
    setTimeout(() => {
      processingRef.current = false;
    }, 0);
  }, [dataStream]); // 只依赖 dataStream，其他函数通过 ref 访问

  return null;
}
