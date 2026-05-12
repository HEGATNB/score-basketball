import type { Team } from "@/entities/team/model/types";

export type Prediction = {
  id: string; // uuid
  team1Id: number;
  team2Id: number;
  team1?: Team;
  team2?: Team;
  confidence?: number;
  probabilityTeam1?: number;
  probabilityTeam2?: number;
  probabilities: { team1: number; team2: number };
  expectedScore: { team1: number; team2: number };
  createdAt: string;
};
