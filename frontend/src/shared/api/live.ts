import { apiRequest } from './client';

export interface LiveTeam {
  id?: string;
  abbrev?: string;
  name?: string;
  shortName?: string;
  color?: string;
  altColor?: string;
  logo?: string;
  score?: number | null;
  record?: string | null;
  winner?: boolean;
  homeAway?: 'home' | 'away';
  linescores?: number[];
}

export interface LiveEvent {
  id: string;
  date: string;
  state: 'pre' | 'in' | 'post';
  completed: boolean;
  detail: string | null;
  shortDetail: string | null;
  clock: string | null;
  period: number | null;
  venue: string | null;
  broadcast: string | null;
  home: LiveTeam;
  away: LiveTeam;
}

export interface LiveScoreboard {
  events: LiveEvent[];
  live: LiveEvent[];
  upcoming: LiveEvent[];
  finished: LiveEvent[];
  fetchedAt: number | null;
  season?: number;
  week?: number;
  error?: string;
}

export interface LiveVideo {
  id: string;
  title: string;
  caption: string | null;
  thumbnail: string | null;
  duration: number | null;
  url: string;
  webUrl: string | null;
  published: string | null;
}

export interface LiveHighlight extends LiveVideo {
  /** YouTube video id resolved by backend — play in-app via iframe */
  youtubeId?: string | null;
  youtubeQuery?: string;
  matchup: {
    eventId: string;
    date: string | null;
    home: { abbrev?: string; name?: string; logo?: string; score?: number | null };
    away: { abbrev?: string; name?: string; logo?: string; score?: number | null };
  };
}

export interface LiveMatchDetails {
  id: string;
  date: string | null;
  venue: string | null;
  broadcast: string | null;
  state: string | null;
  detail: string | null;
  completed: boolean;
  teams: LiveTeam[];
  teamStats: Array<LiveTeam & { stats: Record<string, string> }>;
  leaders: Array<{
    team: LiveTeam;
    name: string;
    value: string;
    athlete: string | null;
  }>;
  videos?: LiveVideo[];
}

export interface LiveNewsItem {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  published: string | null;
  thumb: string | null;
  url: string | null;
  byline?: string | null;
  type?: string | null;
}

export interface LiveArticle {
  id: string;
  title: string;
  description: string | null;
  byline: string | null;
  category: string | null;
  published: string | null;
  lastModified: string | null;
  section: string | null;
  keywords: string[];
  paragraphs: string[];
  images: Array<{
    url: string;
    caption?: string | null;
    credit?: string | null;
    width?: number | null;
    height?: number | null;
  }>;
  related: Array<{ id: string; title: string; url: string | null; thumb: string | null }>;
  url: string | null;
}

export const liveApi = {
  scoreboard: (date?: string) =>
    apiRequest<LiveScoreboard>(`/live/scoreboard${date ? `?date=${date}` : ''}`, undefined, false),
  matchDetails: (espnId: string) =>
    apiRequest<LiveMatchDetails>(`/live/match/${espnId}`, undefined, false),
  news: (limit = 16) => apiRequest<LiveNewsItem[]>(`/live/news?limit=${limit}`, undefined, false),
  article: (id: string) => apiRequest<LiveArticle>(`/live/news/${id}`, undefined, false),
  highlights: (limit = 12) =>
    apiRequest<LiveHighlight[]>(`/live/highlights?limit=${limit}`, undefined, false),
};
