export type Match = {
  id: number;
  date: string; // ISO строка
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  status: "scheduled" | "finished";
  score?: { home: number; away: number };
};
