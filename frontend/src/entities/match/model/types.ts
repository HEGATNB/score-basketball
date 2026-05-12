import type { Team } from "@/entities/team/model/types";

export type Match = {
  id: number;
  date: string; // ISO строка
  homeTeam: Team;
  awayTeam: Team;
  status: "scheduled" | "finished";
  homeScore?: number;
  awayScore?: number;
  score?: { home: number; away: number };
};
