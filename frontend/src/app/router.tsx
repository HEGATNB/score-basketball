import { createBrowserRouter } from "react-router-dom";
import { MainLayout } from "@/widgets/layout/ui/MainLayout";

import { HomePage } from "@/pages/home/ui/HomePage";
import { TeamsPage } from "@/pages/teams/ui/TeamsPage";
import { TeamPage } from "@/pages/team/ui/TeamPage";
import { TeamCreatePage } from "@/pages/team-create/ui/TeamCreatePage"; // <--- Импорт
import { MatchesPage } from "@/pages/matches/ui/MatchesPage";
import { MatchPage } from "@/pages/match/ui/MatchPage";
import { PredictionNewPage } from "@/pages/prediction-new/ui/PredictionNewPage";
import { PredictionResultPage } from "@/pages/prediction-result/ui/PredictionResultPage";
import { HistoryPage } from "@/pages/history/ui/HistoryPage";
import { LoginPage } from "@/pages/login/ui/LoginPage";
import { AdminPage } from "@/pages/admin/ui/AdminPage";
import { NotFoundPage } from "@/pages/not-found/ui/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },

      // Команды
      {
        path: "teams",
        children: [
          { index: true, element: <TeamsPage /> },
          // Важно: create выше, чем :teamId
          { path: "create", element: <TeamCreatePage /> }, 
          { path: ":teamId", element: <TeamPage /> },
        ],
      },

      // Матчи
      {
        path: "matches",
        children: [
          { index: true, element: <MatchesPage /> },
          { path: ":matchId", element: <MatchPage /> },
        ],
      },

      // Прогнозы
      { path: "prediction/new", element: <PredictionNewPage /> },
      { path: "prediction/:id", element: <PredictionResultPage /> },

      // История и Вход
      { path: "history", element: <HistoryPage /> },
      { path: "login", element: <LoginPage /> },

      // Админ-панель
      { path: "admin", element: <AdminPage /> },

      // 404
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
