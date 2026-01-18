import { useEffect, useRef, type RefObject } from 'react';

export function useScrollToBottom<T extends HTMLElement>(): [
  RefObject<T>,
  RefObject<T>,
] {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);

  const scrollToBottom = (smooth = false) => {
    const container = containerRef.current;
    const end = endRef.current;

    if (container && end) {
      // 使用 smooth 或 instant 行为
      end.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'end' });
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;

    if (container && end) {
      // 初始滚动到底部（instant，立即）
      const initialScrollTimer = setTimeout(() => {
        scrollToBottom(false);
      }, 0);

      const observer = new MutationObserver(() => {
        // 内容变化时平滑滚动到底部
        scrollToBottom(true);
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });

      return () => {
        clearTimeout(initialScrollTimer);
        observer.disconnect();
      };
    }
  }, []);

  return [containerRef, endRef];
}
