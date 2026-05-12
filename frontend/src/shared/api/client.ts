import { getTeamBrand } from '@/shared/lib/teamBrand';

export interface AuthUser {
  id: number;
  email: string;
  username: string;
  name: string;
  role: string;
  isBlocked?: boolean;
}

export interface Team {
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
  logoUrl?: string;
  brandColor?: string;
  accentColor?: string;
  conference?: { name: string; shortName?: string };
  division?: { name: string };
}

export interface Match {
  id: number;
  date: string;
  status: 'scheduled' | 'finished' | 'postponed';
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
}

export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  full_name?: string;
  number?: string;
  position?: string;
  team_id: number;
  height?: string;
  weight?: number;
  birth_date?: string;
  points_per_game: number;
  rebounds_per_game: number;
  assists_per_game: number;
  steals_per_game?: number;
  blocks_per_game?: number;
  minutes_per_game?: number;
  image_url?: string;
  team?: Team;
  games_played?: number;
  season?: string;
  seasons?: string[];
  college?: string;
  country?: string;
  draft_year?: string;
  draft_round?: string;
  draft_number?: string;
  usage_rate?: number;
  true_shooting?: number;
  net_rating?: number;
  assist_percentage?: number;
  offensive_rebound_pct?: number;
  defensive_rebound_pct?: number;
  player_height?: string;
  player_weight?: number;
  age?: number;
  team_abbrev?: string;
}

export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  number?: string;
  position?: string;
  height?: string;
  weight?: number;  // ДОЛЖНО БЫТЬ number, НЕ string!
  minutes_per_game?: number;
  points_per_game: number;
  rebounds_per_game: number;
  assists_per_game: number;
  steals_per_game?: number;
  blocks_per_game?: number;
  image_url?: string;
  team?: Team;
  games_played?: number;
  season?: string;
  college?: string;
  country?: string;
  draft_year?: string;
  draft_round?: string;
  draft_number?: string;
  usage_rate?: number;
  true_shooting?: number;
  net_rating?: number;
  assist_percentage?: number;
  offensive_rebound_pct?: number;
  defensive_rebound_pct?: number;
  age?: number;
  team_abbrev?: string;
}

export interface AdminUser extends AuthUser {
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  details: unknown;
  createdAt: string;
  user?: {
    name?: string;
    username?: string;
    email: string;
  };
}

export interface Backup {
  id: string;
  filename: string;
  size: number;
  type: string;
  status: string;
  createdAt: string;
}

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'token';
const CACHE_TTL = 5 * 60 * 1000;

const cache = new Map<string, { data: unknown; timestamp: number }>();

function buildUrl(endpoint: string) {
  return `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function normalizeUser(raw: any): AuthUser {
  const email = raw?.email || '';
  const name = raw?.name || raw?.username || email.split('@')[0] || 'user';

  return {
    id: Number(raw?.id || 0),
    email,
    username: raw?.username || email.split('@')[0] || name.toLowerCase(),
    name,
    role: raw?.role || 'user',
    isBlocked: Boolean(raw?.isBlocked),
  };
}

function normalizeTeam(raw: any): Team {
  const brand = getTeamBrand({
    abbrev: raw?.abbrev,
    name: raw?.fullName || raw?.name,
  });

  return {
    id: Number(raw?.id || 0),
    name: raw?.fullName || raw?.name || 'Unknown team',
    city: raw?.city || undefined,
    abbrev: raw?.abbrev || undefined,
    arena: raw?.arena || undefined,
    wins: Number(raw?.wins ?? raw?.seasonWins ?? 0),
    losses: Number(raw?.losses ?? raw?.seasonLosses ?? 0),
    avgPointsFor: Number(raw?.pointsFor ?? raw?.pointsPerGame ?? 0),
    avgPointsAgainst: Number(raw?.pointsAgainst ?? 0),
    championships: Number(raw?.championships ?? 0),
    foundedYear: raw?.foundedYear ?? undefined,
    pointsPerGame: Number(raw?.pointsPerGame ?? raw?.pointsFor ?? 0),
    pointsAgainst: Number(raw?.pointsAgainst ?? 0),
    logoUrl: raw?.logoUrl || brand.logoUrl,
    brandColor: raw?.brandColor || brand.brandColor,
    accentColor: raw?.accentColor || brand.accentColor,
    conference: raw?.conference
      ? { name: raw.conference.name, shortName: raw.conference.shortName }
      : undefined,
    division: raw?.division ? { name: raw.division.name } : undefined,
  };
}

function normalizeMatch(raw: any): Match {
  let dateStr = raw?.date || new Date().toISOString();

  try {
    if (typeof dateStr === 'string' && dateStr.includes(' ') && !dateStr.includes('T')) {
      const [datePart, timePart] = dateStr.split(' ');
      dateStr = `${datePart}T${timePart}Z`;
    }
  } catch (e) {
    console.warn('Error parsing date:', dateStr);
  }

  return {
    id: Number(raw?.id || 0),
    date: dateStr,
    status: raw?.status || 'scheduled',
    homeTeam: normalizeTeam(raw?.homeTeam || {
      id: raw?.home_team_id,
      name: raw?.home_team?.name || raw?.home_team_name,
      abbrev: raw?.home_team?.abbrev || raw?.home_team_abbrev
    }),
    awayTeam: normalizeTeam(raw?.awayTeam || {
      id: raw?.away_team_id,
      name: raw?.away_team?.name || raw?.away_team_name,
      abbrev: raw?.away_team?.abbrev || raw?.away_team_abbrev
    }),
    homeScore: raw?.home_score ?? null,
    awayScore: raw?.away_score ?? null,
  };
}

function normalizePlayer(raw: any): Player {
  return {
    id: Number(raw?.id || 0),
    first_name: raw?.first_name || raw?.firstName || '',
    last_name: raw?.last_name || raw?.lastName || '',
    number: raw?.number ? Number(raw.number) : undefined,
    position: raw?.position || undefined,
    team_id: 0,
    height: raw?.height ? raw.height : undefined,
    weight: raw?.weight ? Number(raw.weight) : undefined,
    birth_date: raw?.birth_date || undefined,
    points_per_game: Number(raw?.points_per_game || 0),
    rebounds_per_game: Number(raw?.rebounds_per_game || 0),
    assists_per_game: Number(raw?.assists_per_game || 0),
    steals_per_game: Number(raw?.steals_per_game || 0),
    blocks_per_game: Number(raw?.blocks_per_game || 0),
    minutes_per_game: Number(raw?.minutes_per_game || 0),
    image_url: raw?.image_url || undefined,
    games_played: raw?.games_played,
    season: raw?.season,
    seasons: Array.isArray(raw?.seasons) ? raw.seasons : (raw?.season ? [raw.season] : []),
    college: raw?.college,
    country: raw?.country,
    draft_year: raw?.draft_year,
    draft_round: raw?.draft_round,
    draft_number: raw?.draft_number,
    usage_rate: raw?.usage_rate,
    true_shooting: raw?.true_shooting,
    net_rating: raw?.net_rating,
    team: raw?.team_abbrev ? {
      id: 0,
      name: raw.team_abbrev,
      abbrev: raw.team_abbrev,
      wins: 0,
      losses: 0,
      avgPointsFor: 0,
      avgPointsAgainst: 0
    } : undefined
  };
}

function normalizePrediction(raw: any): Prediction {
  const probabilityTeam1 = Number(raw?.probabilityTeam1 ?? raw?.probabilities?.team1 ?? 0);
  const probabilityTeam2 = Number(raw?.probabilityTeam2 ?? raw?.probabilities?.team2 ?? 0);
  const expectedScoreTeam1 = Number(raw?.expectedScoreTeam1 ?? raw?.expectedScore?.team1 ?? 0);
  const expectedScoreTeam2 = Number(raw?.expectedScoreTeam2 ?? raw?.expectedScore?.team2 ?? 0);
  const confidenceValue = Number(raw?.confidence ?? 0);

  return {
    id: raw?.id || '',
    team1Id: Number(raw?.team1Id ?? 0),
    team2Id: Number(raw?.team2Id ?? 0),
    team1: raw?.team1 ? normalizeTeam(raw.team1) : undefined,
    team2: raw?.team2 ? normalizeTeam(raw.team2) : undefined,
    probabilityTeam1,
    probabilityTeam2,
    expectedScoreTeam1,
    expectedScoreTeam2,
    confidence: confidenceValue <= 1 ? Math.round(confidenceValue * 100) : confidenceValue,
    createdAt: raw?.createdAt || new Date().toISOString(),
    probabilities: {
      team1: probabilityTeam1,
      team2: probabilityTeam2,
    },
    expectedScore: {
      team1: expectedScoreTeam1,
      team2: expectedScoreTeam2,
    },
    modelVersion: raw?.modelVersion || undefined,
    trainingDataPoints: raw?.trainingDataPoints ?? undefined,
    factors: raw?.factors || undefined,
  };
}

function normalizeAdminUser(raw: any): AdminUser {
  const user = normalizeUser(raw);
  return {
    ...user,
    createdAt: raw?.createdAt || new Date().toISOString(),
  };
}

function normalizeAuditLog(raw: any): AuditLog {
  return {
    id: raw?.id || '',
    action: raw?.action || 'UNKNOWN',
    entity: raw?.entity || 'Unknown',
    details: raw?.details ?? null,
    createdAt: raw?.createdAt || new Date().toISOString(),
    user: raw?.user
      ? {
          name: raw.user.name || undefined,
          username: raw.user.username || raw.user.name || undefined,
          email: raw.user.email,
        }
      : undefined,
  };
}

function normalizeBackup(raw: any): Backup {
  return {
    id: raw?.id || '',
    filename: raw?.filename || 'backup.json',
    size: Number(raw?.size ?? 0),
    type: raw?.type || 'manual',
    status: raw?.status || 'completed',
    createdAt: raw?.createdAt || new Date().toISOString(),
  };
}

function normalizeByEndpoint(endpoint: string, payload: any): any {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (endpoint.startsWith('/auth/me')) {
    return normalizeUser(payload);
  }

  if (endpoint.startsWith('/teams')) {
    return Array.isArray(payload) ? payload.map(normalizeTeam) : normalizeTeam(payload);
  }

  if (endpoint.startsWith('/predict/stats') || endpoint.startsWith('/predict/evaluate')) {
    return payload;
  }

  if (endpoint.startsWith('/matches')) {
    return Array.isArray(payload) ? payload.map(normalizeMatch) : normalizeMatch(payload);
  }

  if (endpoint.startsWith('/players')) {
    return Array.isArray(payload) ? payload.map(normalizePlayer) : normalizePlayer(payload);
  }

  if (endpoint.startsWith('/predictions') || endpoint.startsWith('/predict')) {
    return Array.isArray(payload) ? payload.map(normalizePrediction) : normalizePrediction(payload);
  }

  if (endpoint.startsWith('/admin/users')) {
    return Array.isArray(payload) ? payload.map(normalizeAdminUser) : normalizeAdminUser(payload);
  }

  if (endpoint.startsWith('/admin/logs')) {
    return Array.isArray(payload) ? payload.map(normalizeAuditLog) : normalizeAuditLog(payload);
  }

  if (endpoint.startsWith('/admin/backups') || endpoint.startsWith('/admin/backup')) {
    return Array.isArray(payload) ? payload.map(normalizeBackup) : normalizeBackup(payload);
  }

  return payload;
}

export async function requestJson<T>(endpoint: string, options?: RequestInit, useCache = false): Promise<T> {
  const method = options?.method || 'GET';
  const cacheKey = `${method}:${endpoint}`;

  if (useCache && method === 'GET') {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data as T;
    }
  }

  const token = getToken();
  const response = await fetch(buildUrl(endpoint), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;

  if (!response.ok) {
    if (response.status === 401) {
      // Токен истек - очищаем
      localStorage.removeItem(TOKEN_KEY);
      throw new Error('Session expired. Please login again.');
    }
    throw new Error(parsed?.error || parsed?.message || `HTTP ${response.status}`);
  }

  const normalized = normalizeByEndpoint(endpoint, parsed) as T;
  if (method !== 'GET') {
    clearCache();
  }

  if (useCache && method === 'GET') {
    cache.set(cacheKey, { data: normalized, timestamp: Date.now() });
  }

  return normalized;
}

export async function apiRequest<T>(endpoint: string, options?: RequestInit, useCache = true): Promise<T> {
  return requestJson<T>(endpoint, options, useCache);
}

export function clearCache() {
  cache.clear();
}