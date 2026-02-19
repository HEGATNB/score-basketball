export type Team = {
  id: number;
  name: string;
  city?: string;
  wins: number;
  losses: number;
  avgPointsFor: number;
  avgPointsAgainst: number;
};