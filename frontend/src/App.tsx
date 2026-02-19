import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './app/Layout';
import { AuthProvider } from './app/providers/AuthProvider';
import { HomePage } from './pages/home/ui/HomePage';
import { TeamsPage } from './pages/teams/ui/TeamsPage';
import { TeamPage } from './pages/teams/ui/TeamPage';
import { MatchesPage } from './pages/matches/ui/MatchesPage';
import { PredictionNewPage } from './pages/prediction-new/ui/PredictionNewPage';
import { PredictionResultPage } from './pages/prediction-result/ui/PredictionResultPage';
import { HistoryPage } from './pages/history/ui/HistoryPage';
import { AuthPage } from './pages/auth/ui/AuthPage';
import { NotFoundPage } from './pages/not-found/ui/NotFoundPage';
import { MatchPage } from './pages/matches/ui/MatchPage';
import { AnalyticsPage } from './pages/analytics/ui/AnalyticsPage';
import { AdminPage } from './pages/admin/ui/AdminPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:teamId" element={<TeamPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/prediction/new" element={<PredictionNewPage />} />
            <Route path="/prediction/:id" element={<PredictionResultPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="*" element={<NotFoundPage />} />
            <Route path="/matches/:matchId" element={<MatchPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;