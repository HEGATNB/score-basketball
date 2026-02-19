import type { Match } from "./types";

export const matchesMock: Match[] = [
  {
    id: 101,
    date: "2026-02-10T18:00:00Z",
    homeTeam: { id: 1, name: "ЦСКА" },
    awayTeam: { id: 2, name: "Зенит" },
    status: "finished",
    score: { home: 89, away: 83 },
  },
  {
    id: 102,
    date: "2026-02-18T16:00:00Z",
    homeTeam: { id: 3, name: "УНИКС" },
    awayTeam: { id: 1, name: "ЦСКА" },
    status: "scheduled",
  },
];
