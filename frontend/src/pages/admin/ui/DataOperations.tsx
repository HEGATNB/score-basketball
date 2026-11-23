import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { apiRequest, requestFile } from '@/shared/api/client';
import { Glass } from '@/shared/ui/Glass';

interface UpdateStatus {
  last_successful_sync: string | null;
  next_data_update: string | null;
  active_job: string | null;
  last_data_update: { updated_results?: number; new_games?: number } | null;
  result_lag: { pending: number; oldest_minutes: number | null } | null;
  alert: 'import_failed' | 'sync_overdue' | 'results_delayed' | null;
}

const alerts = {
  import_failed: 'Последний импорт завершился с ошибкой.',
  sync_overdue: 'Импорт ESPN просрочен или ещё не выполнялся.',
  results_delayed: 'Часть результатов матчей ещё не поступила.',
};

function localDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('ru-RU') : '—';
}

export function DataOperations() {
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [statusUnavailable, setStatusUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const value = await apiRequest<UpdateStatus>('/admin/update-status', { signal }, false);
      setStatus(value);
      setStatusUnavailable(false);
    } catch {
      if (!signal?.aborted) setStatusUnavailable(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = window.setInterval(() => void refresh(controller.signal), 30_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refresh]);

  async function startJob(path: string) {
    setBusy(true);
    setNotice('');
    try {
      await apiRequest(path, { method: 'POST' }, false);
      setNotice('Задача запущена.');
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось запустить задачу.');
    } finally {
      setBusy(false);
    }
  }

  async function exportMatches(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const start = String(form.get('start'));
    const end = String(form.get('end'));
    const query = new URLSearchParams({ start, end });
    setExporting(true);
    setNotice('');
    try {
      const file = await requestFile('/admin/matches.csv?' + query.toString());
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'score-matches-' + start + '-' + end + '.csv';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось скачать CSV.');
    } finally {
      setExporting(false);
    }
  }

  const running = status?.active_job === 'data-update' ? 'Импорт данных' : 'Переобучение модели';
  const oldestLag = status?.result_lag?.oldest_minutes;

  return (
    <Glass rounded="3xl" className="space-y-5 p-6">
      <h2 className="display text-3xl text-cream-50">Обновление данных NBA</h2>
      {statusUnavailable && <p role="alert">Не удалось загрузить статус обновления.</p>}
      {status?.alert && <p className="text-amber-300" role="status">{alerts[status.alert]}</p>}
      {status?.active_job && <p role="status">{running} выполняется.</p>}
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt>Последний успешный импорт</dt><dd>{localDateTime(status?.last_successful_sync)}</dd></div>
        <div><dt>Следующий импорт</dt><dd>{localDateTime(status?.next_data_update)}</dd></div>
        <div><dt>Обновлено результатов</dt><dd>{status?.last_data_update?.updated_results ?? '—'}</dd></div>
        <div>
          <dt>Матчи без результата спустя 6 ч</dt>
          <dd>
            {status?.result_lag?.pending ?? '—'}
            {oldestLag != null && ' · старейший ' + Math.round(oldestLag / 60) + ' ч назад'}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" disabled={busy || !!status?.active_job} onClick={() => startJob('/admin/force-data-update')}>
          Запустить импорт
        </button>
        {isAdmin && (
          <button type="button" className="btn btn-secondary" disabled={busy || !!status?.active_job} onClick={() => startJob('/admin/force-model-retrain')}>
            Переобучить модель
          </button>
        )}
      </div>
      <form className="flex flex-wrap items-end gap-3 border-t border-cream-100/10 pt-4" onSubmit={exportMatches}>
        <label className="grid gap-1">С <input className="input" type="date" name="start" required /></label>
        <label className="grid gap-1">По <input className="input" type="date" name="end" required /></label>
        <button className="btn btn-primary" disabled={exporting}>Скачать CSV матчей</button>
      </form>
      {notice && <p role="status">{notice}</p>}
    </Glass>
  );
}
