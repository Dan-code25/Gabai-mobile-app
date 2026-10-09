import { AppState, AppStateStatus } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearHistory,
  deleteHistory,
  getHistory,
  HistoryRow,
  searchHistory,
} from '../db/historyDb';

const PAGE_SIZE = 20;

export interface UseHistoryResult {
  items: HistoryRow[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  search: (query: string) => void;
  remove: (id: number) => Promise<void>;
  clearAll: () => Promise<void>;
}

export function useHistory(): UseHistoryResult {
  const [items, setItems] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const queryRef = useRef('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);

  const runQuery = useCallback(async (query: string, offset: number, replace: boolean) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);

    try {
      const rows = query
        ? await searchHistory(query)
        : await getHistory({ limit: PAGE_SIZE, offset });

      if (requestId !== requestRef.current) return;

      setItems((previous) => replace ? rows : [...previous, ...rows]);
      offsetRef.current = offset + rows.length;
      hasMoreRef.current = query ? false : rows.length === PAGE_SIZE;
    } catch (caught) {
      if (requestId !== requestRef.current) return;
      const nextError = caught instanceof Error ? caught : new Error('Unable to load history.');
      setError(nextError);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await runQuery(queryRef.current, 0, true);
  }, [runQuery]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMoreRef.current || queryRef.current) return;
    await runQuery('', offsetRef.current, false);
  }, [loading, runQuery]);

  const search = useCallback((query: string) => {
    queryRef.current = query.trim();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    searchTimerRef.current = setTimeout(() => {
      void refresh();
      searchTimerRef.current = null;
    }, 300);
  }, [refresh]);

  const remove = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await deleteHistory(id);
      await refresh();
    } catch (caught) {
      const nextError = caught instanceof Error ? caught : new Error('Unable to delete history.');
      setError(nextError);
      setLoading(false);
    }
  }, [refresh]);

  const clearAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await clearHistory();
      await refresh();
    } catch (caught) {
      const nextError = caught instanceof Error ? caught : new Error('Unable to clear history.');
      setError(nextError);
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') void refresh();
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      requestRef.current += 1;
    };
  }, [refresh]);

  return { items, loading, error, refresh, loadMore, search, remove, clearAll };
}
