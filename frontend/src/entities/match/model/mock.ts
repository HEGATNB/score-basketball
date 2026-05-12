import type { Match } from "./types";

export const matchesMock: Match[] = [
  {
    id: 101,
    date: "2026-02-10T18:00:00Z",
    homeTeam: { id: 1, name: "ЦСКА", wins: 18, losses: 6, avgPointsFor: 84.2, avgPointsAgainst: 78.9 },
    awayTeam: { id: 2, name: "Зенит", wins: 16, losses: 8, avgPointsFor: 82.1, avgPointsAgainst: 79.5 },
    status: "finished",
    score: { home: 89, away: 83 },
    homeScore: 89,
    awayScore: 83
  },
  {
    id: 102,
    date: "2026-02-18T16:00:00Z",
    homeTeam: { id: 3, name: "УНИКС", wins: 14, losses: 10, avgPointsFor: 80.5, avgPointsAgainst: 77.2 },
    awayTeam: { id: 1, name: "ЦСКА", wins: 18, losses: 6, avgPointsFor: 84.2, avgPointsAgainst: 78.9 },
    status: "scheduled",
  },
];
