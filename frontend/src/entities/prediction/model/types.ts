export type Prediction = {
  id: string; // uuid
  team1Id: number;
  team2Id: number;
  probabilities: { team1: number; team2: number };
  expectedScore: { team1: number; team2: number };
  createdAt: string;
};
