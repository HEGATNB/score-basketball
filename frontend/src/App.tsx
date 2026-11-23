import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './app/Layout';
import { ProtectedRoute } from './app/ProtectedRoute';
import { AuthProvider } from './app/providers/AuthProvider';
import { I18nProvider } from './shared/i18n';
import { HomePage } from './pages/home/ui/HomePage';
import { LoadingSpinner } from './shared/ui/LoadingSpinner';

const TeamsPage = lazy(() => import('./pages/teams/ui/TeamsPage'));
const TeamPage = lazy(() => import('./pages/teams/ui/TeamPage'));
const MatchesPage = lazy(() => import('./pages/matches/ui/MatchesPage'));
const MatchPage = lazy(() => import('./pages/matches/ui/MatchPage'));
const LiveMatchPage = lazy(() => import('./pages/matches/ui/LiveMatchPage'));
const PredictionNewPage = lazy(() => import('./pages/prediction-new/ui/PredictionNewPage'));
const PredictionResultPage = lazy(() => import('./pages/prediction-result/ui/PredictionResultPage'));
const HistoryPage = lazy(() => import('./pages/history/ui/HistoryPage'));
const AccountPage = lazy(() => import('./pages/account/ui/AccountPage'));
const AuthPage = lazy(() => import('./pages/auth/ui/AuthPage'));
const AnalyticsPage = lazy(() => import('./pages/analytics/ui/AnalyticsPage'));
const AdminPage = lazy(() => import('./pages/admin/ui/AdminPage'));
const PlayersPage = lazy(() => import('./pages/players/ui/PlayersPage'));
const NewsPage = lazy(() => import('./pages/news/ui/NewsPage'));
const NotFoundPage = lazy(() => import('./pages/not-found/ui/NotFoundPage'));

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <I18nProvider>
      <AuthProvider>
        <Suspense fallback={<LoadingSpinner fullScreen />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/teams/:teamId" element={<TeamPage />} />
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/matches" element={<MatchesPage />} />
              <Route path="/matches/live/:eventId" element={<LiveMatchPage />} />
              <Route path="/matches/:matchId" element={<MatchPage />} />
              <Route path="/news" element={<NewsPage />} />
              <Route
                path="/prediction/new"
                element={<PredictionNewPage />}
              />
              <Route
                path="/prediction/:id"
                element={
                  <ProtectedRoute>
                    <PredictionResultPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/account"
                element={
                  <ProtectedRoute>
                    <AccountPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <ProtectedRoute>
                    <HistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={['admin', 'operator']}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}

export default App;
