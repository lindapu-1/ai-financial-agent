'use client';

import { useMemo, useCallback, useRef } from 'react';
import useSWR from 'swr';
import equal from 'fast-deep-equal';

interface QueryLoadingState {
  isLoading: boolean;
  taskNames: string[];
}

const initialState: QueryLoadingState = {
  isLoading: false,
  taskNames: []
};

// Add type for selector function
type Selector<T> = (state: QueryLoadingState) => T;

export function useQueryLoadingSelector<Selected>(selector: Selector<Selected>) {
  const { data: loadingState } = useSWR<QueryLoadingState>('query-loading', null, {
    fallbackData: initialState,
  });

  const selectedValue = useMemo(() => {
    if (!loadingState) return selector(initialState);
    return selector(loadingState);
  }, [loadingState, selector]);

  return selectedValue;
}

export function useQueryLoading() {
  const { data: loadingState, mutate: setLoadingState } = useSWR<QueryLoadingState>(
    'query-loading',
    null,
    {
      fallbackData: initialState,
    },
  );

  const state = useMemo(() => {
    if (!loadingState) return initialState;
    return loadingState;
  }, [loadingState]);

  // 使用 useRef 跟踪上一次的状态，避免重复更新
  const lastStateRef = useRef<QueryLoadingState>(initialState);
  // 使用 useRef 稳定 setLoadingState 的引用
  const setLoadingStateRef = useRef(setLoadingState);
  setLoadingStateRef.current = setLoadingState;

  const setQueryLoading = useCallback((isLoading: boolean, taskNames: string[] = []) => {
    // 比较新状态和旧状态，只有真正改变时才更新
    const newState = { isLoading, taskNames };
    const lastState = lastStateRef.current;
    
    // 使用 fast-deep-equal 进行深度比较
    if (!equal(lastState, newState)) {
      lastStateRef.current = newState;
      // 使用 revalidate: false 避免触发重新验证
      setLoadingStateRef.current(newState, { revalidate: false });
    }
  }, []); // 移除依赖项，使用 ref 来访问最新的 setLoadingState

  return { state, setQueryLoading };
} 