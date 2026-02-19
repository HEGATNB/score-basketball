import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { TrendingUp, Activity, Calendar, User } from 'lucide-react';

const links = [
  { to: '/', icon: TrendingUp, label: 'Dashboard' },
  { to: '/teams', icon: Activity, label: 'Teams' },
  { to: '/matches', icon: Calendar, label: 'Matches' },
  { to: '/prediction-new', icon: TrendingUp, label: 'Predict' },
  { to: '/history', icon: User, label: 'History' },
];

export function MainLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900">
      <header className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700 p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Basketball AI Predictor</h1>
        <nav>
          <NavLink to="/login" className="btn secondary">Logout</NavLink>
        </nav>
      </header>
      <div className="flex">
        <aside className="w-64 bg-slate-800/30 backdrop-blur-md border-r border-slate-700 p-6">
          <nav className="space-y-2">
            {links.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center space-x-3 p-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                  }`
                }
              >
                <Icon size={20} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
