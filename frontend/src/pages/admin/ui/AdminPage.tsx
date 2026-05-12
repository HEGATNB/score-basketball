import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  Database,
  Download,
  HardDriveDownload,
  RefreshCcw,
  Shield,
  Users,
} from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { apiRequest, type AdminUser, type AuditLog, type Backup } from '@/shared/api/client';
import { Glass } from '@/shared/ui/Glass';
import { Chip } from '@/shared/ui/Chip';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';

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
  return value ? new Date(value).toLocaleString() : '—';
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
    if (!isAdmin) return;

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
        console.error('Admin data load failed', error);
        setNotice({ type: 'error', message: 'Failed to load admin data from the backend.' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeTab, isAdmin]);

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
      const backup = await apiRequest<Backup>('/admin/backup', { method: 'POST' }, false);
      await Promise.all([loadBackups(), loadOverview()]);
      setActiveTab('backups');
      setNotice({ type: 'success', message: `Backup created: ${backup.filename}` });
    } catch (e) {
      console.error(e);
      setNotice({ type: 'error', message: 'Backup creation failed.' });
    } finally {
      setBusyKey(null);
    }
  };

  const handleRestoreBackup = async (backup: Backup) => {
    if (!window.confirm(`Restore ${backup.filename}? This overwrites the current database.`)) return;
    setBusyKey(`restore-${backup.id}`);
    setNotice(null);
    try {
      await apiRequest(`/admin/restore/${backup.id}`, { method: 'POST' }, false);
      await Promise.all([loadBackups(), loadOverview()]);
      setNotice({ type: 'success', message: `Backup restored: ${backup.filename}` });
    } catch (e) {
      console.error(e);
      setNotice({ type: 'error', message: 'Backup restore failed.' });
    } finally {
      setBusyKey(null);
    }
  };

  const toggleUserBlock = async (target: AdminUser) => {
    setBusyKey(`user-${target.id}`);
    setNotice(null);
    try {
      const updated = await apiRequest<AdminUser>(
        `/admin/users/${target.id}/block`,
        { method: 'PUT', body: JSON.stringify({ isBlocked: !target.isBlocked }) },
        false,
      );
      await Promise.all([loadUsers(), loadOverview()]);
      setNotice({
        type: 'success',
        message: `${updated.username} is now ${updated.isBlocked ? 'blocked' : 'active'}.`,
      });
    } catch (e) {
      console.error(e);
      setNotice({ type: 'error', message: 'User status update failed.' });
    } finally {
      setBusyKey(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="md" label="Verifying admin access" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const activeUsers = users.filter((u) => !u.isBlocked).length;
  const blockedUsers = users.filter((u) => u.isBlocked).length;
  const headlineCards = [
    { label: 'Users', value: stats?.totalUsers ?? 0, accent: 'court' },
    { label: 'Predictions', value: stats?.totalPredictions ?? 0, accent: 'gold' },
    { label: 'Players', value: stats?.totalPlayers ?? 0, accent: 'mint' },
    { label: 'Matches', value: stats?.totalMatches ?? 0, accent: 'ice' },
  ] as const;

  return (
    <div className="relative">
      {/* HERO */}
      <section className="relative isolate overflow-hidden border-b border-cream-100/6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,59,59,0.08),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 court-grid opacity-25" />

        <div className="relative mx-auto w-full max-w-[1400px] px-4 pb-16 pt-32 sm:px-6 lg:px-10 lg:pt-40">
          <div className="flex flex-wrap items-center gap-2">
            <Chip variant="live" icon={<Shield className="h-3 w-3" />}>
              Restricted workspace
            </Chip>
            <Chip>{user.email}</Chip>
          </div>
          <h1 className="display mt-6 text-6xl text-balance text-cream-50 sm:text-7xl lg:text-8xl">
            The <span className="text-gradient-court">control</span> room.
          </h1>
          <p className="mt-6 max-w-2xl font-sans-display text-base leading-relaxed text-cream-300">
            Users, audits, backups and stack health — separated into clean panels so moderation and maintenance feel
            tight and easy to scan.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={handleCreateBackup}
              disabled={busyKey === 'create-backup'}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <HardDriveDownload className="h-4 w-4" />
              {busyKey === 'create-backup' ? 'Creating...' : 'New backup'}
            </button>
            <button onClick={() => setActiveTab('users')} className="btn-secondary">
              <Users className="h-4 w-4" />
              Manage users
            </button>
          </div>
        </div>
      </section>

      {/* TABS */}
      <section className="sticky top-[68px] z-20 border-b border-cream-100/6 bg-ink-950/85 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
          <div className="seg">
            {(
              [
                ['overview', 'Overview', Activity],
                ['users', 'Users', Users],
                ['logs', 'Audit', Database],
                ['backups', 'Backups', Download],
              ] as const
            ).map(([tabId, label, Icon]) => (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`seg-item inline-flex items-center gap-2 ${activeTab === tabId ? 'seg-item-active' : ''}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CONTENT */}
      <section className="relative mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6 lg:px-10">
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Glass
              rounded="xl"
              className={`p-4 ${
                notice.type === 'success'
                  ? 'border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-100'
                  : 'border-rose-400/20 bg-rose-500/[0.06] text-rose-100'
              }`}
            >
              {notice.message}
            </Glass>
          </motion.div>
        )}

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <LoadingSpinner size="md" label="Loading" />
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {headlineCards.map((card) => (
                    <Glass key={card.label} rounded="2xl" className="p-6">
                      <p className="stat-label">{card.label}</p>
                      <p
                        className={`stat-value mt-3 text-4xl ${
                          card.accent === 'gold' ? 'text-signal-gold' : 'text-cream-50'
                        }`}
                      >
                        {card.value.toLocaleString()}
                      </p>
                    </Glass>
                  ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
                  <Glass rounded="3xl" className="overflow-hidden">
                    <div className="border-b border-cream-100/6 p-6">
                      <p className="font-sans-display text-[10px] uppercase tracking-[0.32em] text-cream-400">
                        Stack snapshot
                      </p>
                    </div>
                    <div className="divide-y divide-cream-100/6">
                      {[
                        ['Teams tracked', stats?.totalTeams ?? 0],
                        ['Matches tracked', stats?.totalMatches ?? 0],
                        ['Players tracked', stats?.totalPlayers ?? 0],
                        ['Predictions tracked', stats?.totalPredictions ?? 0],
                        ['Backups stored', stats?.totalBackups ?? 0],
                        ['Last backup', formatDateTime(stats?.lastBackupAt)],
                        ['Model accuracy', `${Math.round(stats?.accuracy ?? 0)}%`],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between p-5">
                          <span className="font-sans-display text-sm text-cream-300">{label}</span>
                          <span className="stat-value text-lg text-cream-50">{value}</span>
                        </div>
                      ))}
                    </div>
                  </Glass>

                  <Glass rounded="3xl" className="p-6">
                    <p className="font-sans-display text-[10px] uppercase tracking-[0.32em] text-cream-400">
                      Quick actions
                    </p>
                    <div className="mt-6 grid gap-3">
                      <button
                        onClick={handleCreateBackup}
                        disabled={busyKey === 'create-backup'}
                        className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Download className="h-4 w-4" />
                        {busyKey === 'create-backup' ? 'Creating...' : 'Create backup'}
                      </button>
                      <button onClick={() => setActiveTab('logs')} className="btn-secondary justify-center">
                        <Database className="h-4 w-4" />
                        Audit log
                      </button>
                      <button onClick={() => setActiveTab('users')} className="btn-secondary justify-center">
                        <Users className="h-4 w-4" />
                        Users
                      </button>
                    </div>
                  </Glass>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Glass rounded="xl" className="p-5">
                    <p className="stat-label">Active</p>
                    <p className="stat-value mt-2 text-3xl text-emerald-300">{activeUsers}</p>
                  </Glass>
                  <Glass rounded="xl" className="p-5">
                    <p className="stat-label">Blocked</p>
                    <p className="stat-value mt-2 text-3xl text-rose-300">{blockedUsers}</p>
                  </Glass>
                </div>

                <Glass rounded="3xl" className="overflow-hidden">
                  {users.length === 0 ? (
                    <div className="p-8 text-center font-sans-display text-sm text-cream-400">
                      No users returned by the backend.
                    </div>
                  ) : (
                    <div className="divide-y divide-cream-100/6">
                      {users.map((u) => (
                        <div key={u.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-court-500 to-court-700 font-mono text-sm font-semibold text-cream-50">
                              {(u.name || u.username || u.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="display text-xl text-cream-50">{u.name || u.username}</p>
                              <p className="font-sans-display text-xs text-cream-400">{u.email}</p>
                              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-cream-400">
                                Joined {new Date(u.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Chip variant={u.role === 'admin' ? 'gold' : u.role === 'operator' ? 'court' : 'default'}>
                              {u.role}
                            </Chip>
                            <Chip variant={u.isBlocked ? 'live' : 'mint'}>
                              {u.isBlocked ? 'Blocked' : 'Active'}
                            </Chip>
                            <button
                              onClick={() => toggleUserBlock(u)}
                              disabled={busyKey === `user-${u.id}`}
                              className={`btn ${
                                u.isBlocked
                                  ? 'btn-secondary border-emerald-400/20 text-emerald-200 hover:border-emerald-400/40'
                                  : 'btn-secondary border-rose-400/20 text-rose-200 hover:border-rose-400/40'
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              {busyKey === `user-${u.id}` ? '…' : u.isBlocked ? 'Unblock' : 'Block'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Glass>
              </div>
            )}

            {activeTab === 'logs' && (
              <Glass rounded="3xl" className="overflow-hidden">
                <div className="border-b border-cream-100/6 p-6">
                  <p className="font-sans-display text-[10px] uppercase tracking-[0.32em] text-cream-400">
                    Audit timeline
                  </p>
                </div>
                {logs.length === 0 ? (
                  <div className="p-8 text-center font-sans-display text-sm text-cream-400">
                    No audit events recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-cream-100/6">
                    {logs.map((log) => (
                      <div key={log.id} className="p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip>
                            <span className="font-mono text-[10px]">{formatDateTime(log.createdAt)}</span>
                          </Chip>
                          <Chip variant="court">{log.action}</Chip>
                          <Chip variant="default">{log.entity}</Chip>
                        </div>
                        <p className="mt-3 font-mono text-xs text-cream-200 break-all">
                          {log.details ? JSON.stringify(log.details) : '—'}
                        </p>
                        {log.user && (
                          <p className="mt-2 font-sans-display text-xs text-cream-400">
                            Actor · {log.user.username || log.user.name || log.user.email}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Glass>
            )}

            {activeTab === 'backups' && (
              <div className="space-y-6">
                <Glass rounded="3xl" className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-sans-display text-[10px] uppercase tracking-[0.32em] text-cream-400">
                        Backup ops
                      </p>
                      <h3 className="display mt-2 text-3xl text-cream-50">Take a snapshot</h3>
                      <p className="mt-2 max-w-md font-sans-display text-sm text-cream-300">
                        Create restorable database snapshots straight from the connected admin API.
                      </p>
                    </div>
                    <button
                      onClick={handleCreateBackup}
                      disabled={busyKey === 'create-backup'}
                      className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download className="h-4 w-4" />
                      {busyKey === 'create-backup' ? 'Creating...' : 'New backup'}
                    </button>
                  </div>
                </Glass>

                <Glass rounded="3xl" className="overflow-hidden">
                  {backups.length === 0 ? (
                    <div className="p-8 text-center font-sans-display text-sm text-cream-400">
                      No backups available.
                    </div>
                  ) : (
                    <div className="divide-y divide-cream-100/6">
                      {backups.map((backup) => (
                        <div key={backup.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                          <div>
                            <p className="display text-xl text-cream-50">{backup.filename}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 font-sans-display text-xs text-cream-400">
                              <span>{formatDateTime(backup.createdAt)}</span>
                              <span>·</span>
                              <span>{(backup.size / 1024).toFixed(2)} KB</span>
                              <span>·</span>
                              <span>{backup.type}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Chip variant="mint">{backup.status}</Chip>
                            <button
                              onClick={() => handleRestoreBackup(backup)}
                              disabled={busyKey === `restore-${backup.id}`}
                              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <RefreshCcw className="h-3.5 w-3.5" />
                              {busyKey === `restore-${backup.id}` ? 'Restoring…' : 'Restore'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Glass>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default AdminPage;
