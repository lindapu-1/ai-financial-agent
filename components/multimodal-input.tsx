'use client';

import type {
  Attachment,
  ChatRequestOptions,
  CreateMessage,
  Message,
} from 'ai';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { sanitizeUIMessages } from '@/lib/utils';

import { ArrowUpIcon, PaperclipIcon, StopIcon } from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { SuggestedActions } from './suggested-actions';
import equal from 'fast-deep-equal';
import { TickerSuggestions } from './ticker-suggestions';
import { useQueryLoading } from '@/hooks/use-query-loading';
import { usePathname } from 'next/navigation';

const TICKER_SUGGESTIONS = ['AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA'];

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  isLoading,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
  showSuggestedActions = true,
}: {
  chatId: string;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  className?: string;
  showSuggestedActions?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const { state: queryLoadingState } = useQueryLoading();
  const pathname = usePathname();
  
  // 如果 useChat 的 isLoading 或 queryLoadingState 中任何一个为 true，都显示停止按钮
  const shouldShowStopButton = isLoading || queryLoadingState.isLoading;

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    setInput(newValue);
    adjustHeight();

    // Handle ticker suggestions
    const lastAtIndex = newValue.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = newValue.slice(lastAtIndex + 1);
      const match = textAfterAt.match(/^[A-Za-z]*$/);
      
      if (match) {
        setShowTickerSuggestions(true);
        setTickerFilter(textAfterAt);
        setSelectedIndex(0); // Reset selection when filter changes
        
        // Calculate menu position
        const textarea = textareaRef.current;
        if (textarea) {
          const textBeforeCursor = newValue.slice(0, textarea.selectionStart);
          const span = document.createElement('span');
          span.style.font = window.getComputedStyle(textarea).font;
          span.style.visibility = 'hidden';
          span.style.position = 'absolute';
          span.textContent = textBeforeCursor;
          document.body.appendChild(span);
          
          const rect = textarea.getBoundingClientRect();
          const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
          const lines = textBeforeCursor.split('\n');
          const currentLineNumber = lines.length - 1;
          
          setMenuPosition({
            // Position the menu above the cursor
            top: rect.top + window.scrollY + (currentLineNumber * lineHeight) - 8,
            left: rect.left + span.offsetWidth - textBeforeCursor.length * 2,
          });
          
          document.body.removeChild(span);
        }
      } else {
        setShowTickerSuggestions(false);
      }
    } else {
      setShowTickerSuggestions(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    // 根据当前路径决定应该更新到哪个路由
    // 保持当前路由前缀（/canvas, /general, /chat），只更新 ID
    let targetPath = `/chat/${chatId}`; // 默认回退到 /chat
    
    if (pathname?.startsWith('/canvas/')) {
      targetPath = `/canvas/${chatId}`;
    } else if (pathname?.startsWith('/general/')) {
      targetPath = `/general/${chatId}`;
    } else if (pathname?.startsWith('/chat/')) {
      targetPath = `/chat/${chatId}`;
    } else if (pathname === '/canvas') {
      // 如果当前在 /canvas（没有 ID），发送第一条消息后应该跳转到 /canvas/{chatId}
      targetPath = `/canvas/${chatId}`;
    } else if (pathname === '/general') {
      // 如果当前在 /general（没有 ID），发送第一条消息后应该跳转到 /general/{chatId}
      targetPath = `/general/${chatId}`;
    }
    
    window.history.replaceState({}, '', targetPath);

    handleSubmit(undefined, {
      experimental_attachments: attachments,
    });

    setAttachments([]);
    setLocalStorageInput('');

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    attachments,
    handleSubmit,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    pathname,
  ]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  const [showTickerSuggestions, setShowTickerSuggestions] = useState(false);
  const [tickerFilter, setTickerFilter] = useState('');
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const handleTickerSelect = (ticker: string) => {
    const parts = input.split('@');
    const newInput = parts.slice(0, -1).join('@') + ticker + ' ';
    setInput(newInput);
    setShowTickerSuggestions(false);
    setTickerFilter('');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const filteredSuggestions = TICKER_SUGGESTIONS.filter(ticker => 
    ticker.toLowerCase().startsWith(tickerFilter.toLowerCase())
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showTickerSuggestions && filteredSuggestions.length > 0) {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) => 
            prev > 0 ? prev - 1 : filteredSuggestions.length - 1
          );
          break;
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) => 
            prev < filteredSuggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'Enter':
          if (!event.shiftKey) {
            event.preventDefault();
            handleTickerSelect(filteredSuggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          setShowTickerSuggestions(false);
          break;
      }
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (shouldShowStopButton) {
        toast.error('请先点击停止按钮停止当前生成，然后再发送新消息');
      } else {
        submitForm();
      }
    }
  };

  return (
    <div className="relative w-full flex flex-col gap-4">
      {showSuggestedActions &&
        messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions append={append} chatId={chatId} />
        )}

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div className="flex flex-row gap-2 overflow-x-scroll items-end">
          {attachments.map((attachment) => (
            <PreviewAttachment key={attachment.url} attachment={attachment} />
          ))}

          {uploadQueue.map((filename) => (
            <PreviewAttachment
              key={filename}
              attachment={{
                url: '',
                name: filename,
                contentType: '',
              }}
              isUploading={true}
            />
          ))}
        </div>
      )}

      {showTickerSuggestions && (
        <TickerSuggestions
          suggestions={filteredSuggestions}
          onSelect={handleTickerSelect}
          position={menuPosition}
          selectedIndex={selectedIndex}
        />
      )}

      <Textarea
        ref={textareaRef}
        placeholder="Send a message...type @ to include tickers"
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        className={cx(
          'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base bg-muted pb-10 dark:border-zinc-700',
          className,
        )}
        rows={2}
        autoFocus
      />

      <div className="absolute bottom-0 p-2 w-fit flex flex-row justify-start">
        <AttachmentsButton fileInputRef={fileInputRef} isLoading={shouldShowStopButton} />
      </div>

      <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end z-10">
        {shouldShowStopButton ? (
          <StopButton stop={stop} setMessages={setMessages} />
        ) : (
          <SendButton
            input={input}
            submitForm={submitForm}
            uploadQueue={uploadQueue}
          />
        )}
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.showSuggestedActions !== nextProps.showSuggestedActions) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;

    return true;
  },
);

function PureAttachmentsButton({
  fileInputRef,
  isLoading,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  isLoading: boolean;
}) {
  return (
    <Button
      className="rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={isLoading}
      variant="ghost"
    >
      <PaperclipIcon size={14} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
}) {
  const { setQueryLoading } = useQueryLoading();

  const handleStop = (event: React.MouseEvent) => {
    event.preventDefault();
    
    // 先清理 query loading 状态（立即生效）
    setQueryLoading(false, []);
    
    // 然后调用 stop（这会清理 useChat 的 isLoading 状态）
    stop();
    
    // 清理消息中的不完整内容
    setMessages((messages) => sanitizeUIMessages(messages));
    
    toast.success('已停止生成，可以发送新消息');
  };

  return (
    <Button
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600 bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700"
      onClick={handleStop}
      title="停止生成"
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
}) {
  return (
    <Button
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={input.length === 0 || uploadQueue.length > 0}
      title="发送消息"
    >
      <ArrowUpIcon size={14} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  return true;
});
