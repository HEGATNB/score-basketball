import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/providers/AuthProvider';
import { apiRequest } from '@/shared/api/client';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { 
  Shield, 
  Users, 
  Database, 
  Activity, 
  Download, 
  Upload,
  Trash2,
  PlusCircle,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  isBlocked: boolean;
  createdAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  details: any;
  createdAt: string;
  user?: {
    name: string;
    email: string;
  };
}

interface Backup {
  id: string;
  filename: string;
  size: number;
  type: string;
  status: string;
  createdAt: string;
}

export const AdminPage = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'backup' | 'stats'>('stats');
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [backupJson, setBackupJson] = useState('');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'logs') loadLogs();
    if (activeTab === 'backup') loadBackups();
    if (activeTab === 'stats') loadStats();
  }, [activeTab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<User[]>('/admin/users');
      setUsers(data);
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<AuditLog[]>('/admin/logs');
      setLogs(data);
    } catch (err) {
      console.error('Ошибка загрузки логов:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Backup[]>('/admin/backups');
      setBackups(data);
    } catch (err) {
      console.error('Ошибка загрузки бэкапов:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any>('/admin/stats');
      setStats(data);
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      const result = await apiRequest<any>('/admin/backup', { method: 'POST' });
      alert('✅ Бэкап создан: ' + result.filename);
      loadBackups();
    } catch (err) {
      alert('❌ Ошибка создания бэкапа');
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm('Это перезапишет текущую базу! Уверены?')) return;
    
    try {
      await apiRequest(`/admin/restore/${backupId}`, { method: 'POST' });
      alert('✅ База восстановлена');
    } catch (err) {
      alert('❌ Ошибка восстановления');
    }
  };

  const toggleUserBlock = async (userId: number, currentState: boolean) => {
    try {
      await apiRequest(`/admin/users/${userId}/block`, {
        method: 'PUT',
        body: JSON.stringify({ isBlocked: !currentState })
      });
      loadUsers();
    } catch (err) {
      alert('❌ Ошибка изменения статуса');
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <Shield className="w-8 h-8 text-orange-400" />
        <div>
          <h1 className="text-3xl font-bold text-white">Панель администратора</h1>
          <p className="text-slate-400">Управление системой</p>
        </div>
      </motion.div>

      {/* Табы */}
      <div className="flex gap-2 border-b border-slate-800 pb-4">
        {[
          { id: 'stats', label: 'Статистика', icon: Activity },
          { id: 'users', label: 'Пользователи', icon: Users },
          { id: 'logs', label: 'Журнал', icon: Database },
          { id: 'backup', label: 'Бэкапы', icon: Download },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === tab.id
                ? 'bg-orange-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Контент вкладок */}
      <div className="min-h-[400px]">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Статистика */}
        {activeTab === 'stats' && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GlowingCard className="p-6">
              <p className="text-slate-400 mb-2">Всего пользователей</p>
              <p className="text-3xl font-bold text-white">{stats?.totalUsers || 0}</p>
            </GlowingCard>
            <GlowingCard className="p-6">
              <p className="text-slate-400 mb-2">Всего прогнозов</p>
              <p className="text-3xl font-bold text-white">{stats?.totalPredictions || 0}</p>
            </GlowingCard>
            <GlowingCard className="p-6">
              <p className="text-slate-400 mb-2">Точность модели</p>
              <p className="text-3xl font-bold text-orange-400">{stats?.accuracy || 0}%</p>
            </GlowingCard>
          </div>
        )}

        {/* Пользователи */}
        {activeTab === 'users' && !loading && (
          <GlowingCard className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Управление пользователями</h3>
              <button className="px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 flex items-center gap-2">
                <PlusCircle className="w-4 h-4" />
                Добавить
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-3 text-slate-400">ID</th>
                    <th className="text-left py-3 text-slate-400">Имя</th>
                    <th className="text-left py-3 text-slate-400">Email</th>
                    <th className="text-left py-3 text-slate-400">Роль</th>
                    <th className="text-left py-3 text-slate-400">Статус</th>
                    <th className="text-left py-3 text-slate-400">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-800/50">
                      <td className="py-3">{u.id}</td>
                      <td className="py-3">{u.name}</td>
                      <td className="py-3">{u.email}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          u.role === 'admin' ? 'bg-orange-500/20 text-orange-400' :
                          u.role === 'operator' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          u.isBlocked ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                          {u.isBlocked ? 'Заблокирован' : 'Активен'}
                        </span>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => toggleUserBlock(u.id, u.isBlocked)}
                          className={`px-3 py-1 rounded-lg text-sm ${
                            u.isBlocked 
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          }`}
                        >
                          {u.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlowingCard>
        )}

        {/* Журнал действий */}
        {activeTab === 'logs' && !loading && (
          <GlowingCard className="p-6">
            <h3 className="text-lg font-bold text-white mb-6">Журнал действий</h3>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="p-4 bg-slate-800/30 rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-xs">
                      {log.action}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs">
                      {log.entity}
                    </span>
                  </div>
                  <p className="text-white">{log.details ? JSON.stringify(log.details) : ''}</p>
                  {log.user && (
                    <p className="text-xs text-slate-500 mt-1">
                      Пользователь: {log.user.name} ({log.user.email})
                    </p>
                  )}
                </div>
              ))}
            </div>
          </GlowingCard>
        )}

        {/* Бэкапы */}
        {activeTab === 'backup' && !loading && (
          <div className="space-y-6">
            <GlowingCard className="p-6">
              <h3 className="text-lg font-bold text-white mb-4">Создать бэкап</h3>
              <button
                onClick={handleCreateBackup}
                className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Создать резервную копию
              </button>
            </GlowingCard>

            <GlowingCard className="p-6">
              <h3 className="text-lg font-bold text-white mb-4">Существующие бэкапы</h3>
              
              <div className="space-y-3">
                {backups.map((backup) => (
                  <div key={backup.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl">
                    <div>
                      <p className="text-white font-medium">{backup.filename}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(backup.createdAt).toLocaleString()} • {(backup.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestoreBackup(backup.id)}
                      className="px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30"
                    >
                      Восстановить
                    </button>
                  </div>
                ))}
              </div>
            </GlowingCard>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;