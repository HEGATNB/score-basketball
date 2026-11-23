import { useCallback, useEffect, useState } from 'react';
import { liveApi, type LiveScoreboard } from '@/shared/api/live';

export function useLiveScoreboard(refreshMs = 30_000) {
  const [data, setData] = useState<LiveScoreboard | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    let timer: number;

    const load = async () => {
      setRefreshing(true);
      try {
        const next = await liveApi.scoreboard();
        if (!active) return;
        if (next.error) {
          setFailed(true);
        } else {
          setData(next);
          setFailed(false);
        }
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) {
          setRefreshing(false);
          timer = window.setTimeout(load, refreshMs);
        }
      }
    };

    void load();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [refreshMs, revision]);

  return { data, failed, refreshing, refresh, stale: Boolean(data && (data.stale || failed)) };
}
