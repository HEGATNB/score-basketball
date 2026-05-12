export type Team = {
  id: number;
  name: string;
  city?: string;
  abbrev?: string;
  arena?: string;
  wins: number;
  losses: number;
  avgPointsFor: number;
  avgPointsAgainst: number;
  championships?: number;
  foundedYear?: number;
  pointsPerGame?: number;
  pointsAgainst?: number;
};
