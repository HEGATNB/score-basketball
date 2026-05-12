import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Database, Download, HardDriveDownload, RefreshCcw, Shield, Users } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { apiRequest, type AdminUser, type AuditLog, type Backup } from '@/shared/api/client';
import { GlowingCard } from '@/shared/ui/GlowingCard';

interface AdminStats {
  totalUsers: number;
  totalTeams: number;
  totalPlayers: number;
  totalMatches: number;
  totalPredictions: number;
  totalBackups: number;
  accuracy: number | null;
  lastBackupAt: string | null;
}

type AdminTab = 'overview' | 'users' | 'logs' | 'backups';

function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'No backups yet';
}

function getUserStatusTone(isBlocked: boolean) {
  return isBlocked
    ? 'border-rose-400/20 bg-rose-500/10 text-rose-100'
    : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100';
}

export const AdminPage = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setNotice(null);

      try {
        if (activeTab === 'overview') {
          setStats(await apiRequest<AdminStats>('/admin/stats', undefined, false));
          return;
        }

        if (activeTab === 'users') {
          setUsers(await apiRequest<AdminUser[]>('/admin/users', undefined, false));
          return;
        }

        if (activeTab === 'logs') {
          setLogs(await apiRequest<AuditLog[]>('/admin/logs', undefined, false));
          return;
        }

        setBackups(await apiRequest<Backup[]>('/admin/backups', undefined, false));
      } catch (error) {
        console.error('Failed to load admin data', error);
        setNotice({ type: 'error', message: 'Failed to load admin data from the backend.' });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [activeTab, isAdmin]);

  const headlineCards = [
    { label: 'Users', value: stats?.totalUsers ?? 0, meta: 'registered accounts', glowColor: 'orange' as const },
    { label: 'Predictions', value: stats?.totalPredictions ?? 0, meta: 'stored inference runs', glowColor: 'blue' as const },
    { label: 'Players', value: stats?.totalPlayers ?? 0, meta: 'seeded athlete profiles', glowColor: 'green' as const },
    { label: 'Matches', value: stats?.totalMatches ?? 0, meta: 'live schedule records', glowColor: 'purple' as const },
  ];

  const activeUsers = users.filter((account) => !account.isBlocked).length;
  const blockedUsers = users.filter((account) => account.isBlocked).length;

  const loadOverview = async () => {
    setStats(await apiRequest<AdminStats>('/admin/stats', undefined, false));
  };

  const loadUsers = async () => {
    setUsers(await apiRequest<AdminUser[]>('/admin/users', undefined, false));
  };

  const loadBackups = async () => {
    setBackups(await apiRequest<Backup[]>('/admin/backups', undefined, false));
  };

  const handleCreateBackup = async () => {
    setBusyKey('create-backup');
    setNotice(null);

    try {
      const backup = await apiRequest<Backup>(
        '/admin/backup',
        {
          method: 'POST',
        },
        false,
      );

      await Promise.all([loadBackups(), loadOverview()]);
      setActiveTab('backups');
      setNotice({ type: 'success', message: `Backup created: ${backup.filename}` });
    } catch (error) {
      console.error('Failed to create backup', error);
      setNotice({ type: 'error', message: 'Backup creation failed.' });
    } finally {
      setBusyKey(null);
    }
  };

  const handleRestoreBackup = async (backup: Backup) => {
    const shouldRestore = window.confirm(`Restore ${backup.filename}? This will overwrite the current database content.`);

    if (!shouldRestore) {
      return;
    }

    setBusyKey(`restore-${backup.id}`);
    setNotice(null);

    try {
      await apiRequest(
        `/admin/restore/${backup.id}`,
        {
          method: 'POST',
        },
        false,
      );

      await Promise.all([loadBackups(), loadOverview()]);
      setNotice({ type: 'success', message: `Backup restored: ${backup.filename}` });
    } catch (error) {
      console.error('Failed to restore backup', error);
      setNotice({ type: 'error', message: 'Backup restore failed.' });
    } finally {
      setBusyKey(null);
    }
  };

  const toggleUserBlock = async (targetUser: AdminUser) => {
    setBusyKey(`user-${targetUser.id}`);
    setNotice(null);

    try {
      const updated = await apiRequest<AdminUser>(
        `/admin/users/${targetUser.id}/block`,
        {
          method: 'PUT',
          body: JSON.stringify({ isBlocked: !targetUser.isBlocked }),
        },
        false,
      );

      await Promise.all([loadUsers(), loadOverview()]);
      setNotice({
        type: 'success',
        message: `${updated.username} is now ${updated.isBlocked ? 'blocked' : 'active'}.`,
      });
    } catch (error) {
      console.error('Failed to change user status', error);
      setNotice({ type: 'error', message: 'User status update failed.' });
    } finally {
      setBusyKey(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-[rgba(216,180,106,0.22)] border-t-[#c96a2b]" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_360px]">
        <GlowingCard glowColor="orange" className="p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="data-chip">
              <Shield className="h-3.5 w-3.5" />
              Restricted workspace
            </span>
            <span className="data-chip">{user.email}</span>
          </div>

          <h1 className="mt-5 max-w-3xl font-spacegrotesk text-4xl font-bold leading-tight text-white sm:text-5xl">
            Admin tools grouped into a cleaner control room.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            Users, audits and backups stay in separate operational views so moderation and maintenance feel tighter and
            easier to scan.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCreateBackup}
              disabled={busyKey === 'create-backup'}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              <HardDriveDownload className="h-4 w-4" />
              {busyKey === 'create-backup' ? 'Creating backup...' : 'Create backup'}
            </button>
            <button type="button" onClick={() => setActiveTab('users')} className="btn-secondary">
              <Users className="h-4 w-4" />
              Review users
            </button>
          </div>
        </GlowingCard>

        <GlowingCard glowColor="blue" className="p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[rgba(214,225,235,0.72)]">System snapshot</p>
          <div className="mt-5 grid gap-3">
            <div className="surface-muted">
              <p className="text-sm text-slate-400">Model accuracy</p>
              <p className="mt-2 text-3xl font-semibold text-white">{Math.round(stats?.accuracy ?? 0)}%</p>
            </div>
            <div className="surface-muted">
              <p className="text-sm text-slate-400">Backups stored</p>
              <p className="mt-2 text-3xl font-semibold text-white">{stats?.totalBackups ?? 0}</p>
            </div>
            <div className="surface-muted">
              <p className="text-sm text-slate-400">Last backup</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatDateTime(stats?.lastBackupAt)}
              </p>
            </div>
          </div>
        </GlowingCard>
      </section>

      {notice && (
        <div
          className={`rounded-xl border px-5 py-4 text-sm ${
            notice.type === 'success'
              ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-400/20 bg-rose-500/10 text-rose-100'
          }`}
        >
          {notice.message}
        </div>
      )}

      <div className="segmented-bar">
        {([
          ['overview', 'Overview', Activity],
          ['users', 'Users', Users],
          ['logs', 'Audit log', Database],
          ['backups', 'Backups', Download],
        ] as const).map(([tabId, label, Icon]) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setActiveTab(tabId)}
            className={`segmented-item inline-flex items-center gap-2 ${activeTab === tabId ? 'segmented-item-active' : ''}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-[rgba(216,180,106,0.22)] border-t-[#c96a2b]" />
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <section className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {headlineCards.map((card) => (
                  <GlowingCard key={card.label} glowColor={card.glowColor} className="p-5">
                    <p className="text-sm text-slate-400">{card.label}</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{card.value}</p>
                    <p className="mt-2 text-sm text-slate-500">{card.meta}</p>
                  </GlowingCard>
                ))}
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <GlowingCard glowColor="green" className="p-0">
                  <div className="table-head">Stack status</div>
                  <div className="grid gap-0">
                    {[
                      ['Teams tracked', stats?.totalTeams ?? 0],
                      ['Matches tracked', stats?.totalMatches ?? 0],
                      ['Players tracked', stats?.totalPlayers ?? 0],
                      ['Predictions tracked', stats?.totalPredictions ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="table-row flex items-center justify-between px-5 py-4">
                        <span className="text-sm text-slate-400">{label}</span>
                        <span className="text-lg font-semibold text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                </GlowingCard>

                <GlowingCard glowColor="blue" className="p-6">
                  <h3 className="text-2xl font-semibold text-white">Quick actions</h3>
                  <div className="mt-5 grid gap-3">
                    <button
                      type="button"
                      onClick={handleCreateBackup}
                      disabled={busyKey === 'create-backup'}
                      className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Download className="h-4 w-4" />
                      {busyKey === 'create-backup' ? 'Creating backup...' : 'Create new backup'}
                    </button>
                    <button type="button" onClick={() => setActiveTab('logs')} className="btn-secondary justify-center">
                      <Database className="h-4 w-4" />
                      Open audit log
                    </button>
                  </div>
                </GlowingCard>
              </div>
            </section>
          )}

          {activeTab === 'users' && (
            <section className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="surface-muted">
                  <p className="text-sm text-slate-400">Active accounts</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{activeUsers}</p>
                </div>
                <div className="surface-muted">
                  <p className="text-sm text-slate-400">Blocked accounts</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{blockedUsers}</p>
                </div>
              </div>

              <GlowingCard glowColor="blue" className="overflow-hidden p-0">
                {users.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-slate-400">No users were returned by the backend.</div>
                ) : (
                  <>
                    <div className="hidden lg:block">
                      <table className="w-full table-fixed border-collapse">
                        <colgroup>
                          <col />
                          <col style={{ width: '110px' }} />
                          <col style={{ width: '130px' }} />
                          <col style={{ width: '148px' }} />
                        </colgroup>
                        <thead className="bg-white/[0.02]">
                          <tr className="border-b border-white/8">
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              User
                            </th>
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Role
                            </th>
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Status
                            </th>
                            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((adminUser) => (
                            <tr key={adminUser.id} className="border-t border-white/6 transition-colors hover:bg-white/[0.03]">
                              <td className="px-5 py-4 align-middle">
                                <p className="text-base font-semibold text-white">{adminUser.name || adminUser.username}</p>
                                <p className="mt-1 text-sm text-slate-300">{adminUser.email}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                                  Joined {new Date(adminUser.createdAt).toLocaleDateString()}
                                </p>
                              </td>
                              <td className="px-5 py-4 align-middle text-sm text-white">{adminUser.role}</td>
                              <td className="px-5 py-4 align-middle">
                                <span className={`status-pill ${getUserStatusTone(adminUser.isBlocked)}`}>
                                  {adminUser.isBlocked ? 'Blocked' : 'Active'}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-right align-middle">
                                <button
                                  type="button"
                                  onClick={() => toggleUserBlock(adminUser)}
                                  disabled={busyKey === `user-${adminUser.id}`}
                                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                    adminUser.isBlocked
                                      ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15'
                                      : 'border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15'
                                  }`}
                                >
                                  {busyKey === `user-${adminUser.id}` ? 'Updating...' : adminUser.isBlocked ? 'Unblock' : 'Block'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="lg:hidden">
                      {users.map((adminUser) => (
                        <div key={adminUser.id} className="table-row px-5 py-4">
                          <div>
                            <p className="text-base font-semibold text-white">{adminUser.name || adminUser.username}</p>
                            <p className="mt-1 text-sm text-slate-300">{adminUser.email}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                              Joined {new Date(adminUser.createdAt).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-4">
                            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Role</span>
                            <span className="text-sm text-white">{adminUser.role}</span>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-4">
                            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</span>
                            <span className={`status-pill ${getUserStatusTone(adminUser.isBlocked)}`}>
                              {adminUser.isBlocked ? 'Blocked' : 'Active'}
                            </span>
                          </div>

                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => toggleUserBlock(adminUser)}
                              disabled={busyKey === `user-${adminUser.id}`}
                              className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                adminUser.isBlocked
                                  ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15'
                                  : 'border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15'
                              }`}
                            >
                              {busyKey === `user-${adminUser.id}` ? 'Updating...' : adminUser.isBlocked ? 'Unblock' : 'Block'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </GlowingCard>
            </section>
          )}

          {activeTab === 'logs' && (
            <GlowingCard glowColor="purple" className="p-0">
              <div className="table-head">Audit timeline</div>
              {logs.length === 0 ? (
                <div className="px-5 py-6 text-sm text-slate-400">No audit events were returned by the backend.</div>
              ) : (
                <div>
                  {logs.map((log) => (
                    <div key={log.id} className="table-row px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                        <span>{formatDateTime(log.createdAt)}</span>
                        <span className="status-pill border-orange-400/20 bg-orange-500/10 text-orange-100">{log.action}</span>
                        <span className="status-pill border-cyan-400/20 bg-cyan-500/10 text-cyan-100">{log.entity}</span>
                      </div>
                      <p className="mt-3 text-sm text-slate-200">
                        {log.details ? JSON.stringify(log.details) : 'No additional details were recorded.'}
                      </p>
                      {log.user && (
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                          Actor: {log.user.username || log.user.name || log.user.email}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </GlowingCard>
          )}

          {activeTab === 'backups' && (
            <section className="space-y-6">
              <GlowingCard glowColor="orange" className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold text-white">Backup operations</h3>
                    <p className="mt-2 text-slate-300">Create restorable snapshots directly from the connected admin API.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateBackup}
                    disabled={busyKey === 'create-backup'}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <Download className="h-4 w-4" />
                    {busyKey === 'create-backup' ? 'Creating backup...' : 'Create new backup'}
                  </button>
                </div>
              </GlowingCard>

              <GlowingCard glowColor="blue" className="overflow-hidden p-0">
                {backups.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-slate-400">No backups are currently available.</div>
                ) : (
                  <>
                    <div className="hidden lg:block">
                      <table className="w-full table-fixed border-collapse">
                        <colgroup>
                          <col />
                          <col style={{ width: '96px' }} />
                          <col style={{ width: '120px' }} />
                          <col style={{ width: '148px' }} />
                        </colgroup>
                        <thead className="bg-white/[0.02]">
                          <tr className="border-b border-white/8">
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Backup
                            </th>
                            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Size
                            </th>
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Status
                            </th>
                            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {backups.map((backup) => (
                            <tr key={backup.id} className="border-t border-white/6 transition-colors hover:bg-white/[0.03]">
                              <td className="px-5 py-4 align-middle">
                                <h4 className="text-lg font-semibold text-white">{backup.filename}</h4>
                                <p className="mt-1 text-sm text-slate-300">{formatDateTime(backup.createdAt)}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{backup.type}</p>
                              </td>
                              <td className="px-5 py-4 text-right align-middle text-sm tabular-nums text-white">
                                {(backup.size / 1024).toFixed(2)} KB
                              </td>
                              <td className="px-5 py-4 align-middle">
                                <span className="status-pill border-cyan-400/20 bg-cyan-500/10 text-cyan-100">{backup.status}</span>
                              </td>
                              <td className="px-5 py-4 text-right align-middle">
                                <button
                                  type="button"
                                  onClick={() => handleRestoreBackup(backup)}
                                  disabled={busyKey === `restore-${backup.id}`}
                                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <RefreshCcw className="h-4 w-4" />
                                  {busyKey === `restore-${backup.id}` ? 'Restoring...' : 'Restore'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="lg:hidden">
                      {backups.map((backup) => (
                        <div key={backup.id} className="table-row px-5 py-4">
                          <div>
                            <h4 className="text-lg font-semibold text-white">{backup.filename}</h4>
                            <p className="mt-1 text-sm text-slate-300">{formatDateTime(backup.createdAt)}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{backup.type}</p>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-4">
                            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Size</span>
                            <span className="text-sm tabular-nums text-white">{(backup.size / 1024).toFixed(2)} KB</span>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-4">
                            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</span>
                            <span className="status-pill border-cyan-400/20 bg-cyan-500/10 text-cyan-100">{backup.status}</span>
                          </div>

                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => handleRestoreBackup(backup)}
                              disabled={busyKey === `restore-${backup.id}`}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <RefreshCcw className="h-4 w-4" />
                              {busyKey === `restore-${backup.id}` ? 'Restoring...' : 'Restore'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </GlowingCard>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default AdminPage;
