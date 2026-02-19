const API_BASE = 'http://localhost:8000';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Типы данных
export interface Team {
  id: number;
  name: string;
  abbrev: string;
  fullName: string;
  nickname: string;
  city: string;
  arena: string;
  foundedYear: number;
  championships: number;
  wins: number;
  losses: number;
  pointsPerGame: number;
  pointsAgainst: number;
  conferenceId: number;
  divisionId: number;
  conference?: {
    id: number;
    name: string;
    shortName: string;
  };
  division?: {
    id: number;
    name: string;
  };
}

export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string;
  height: number;
  weight: number;
  pointsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  teamId: number;
  team?: Team;
}

export interface Match {
  id: number;
  date: string;
  status: string;
  homeTeamId: number;
  homeTeam: Team;
  homeScore: number;
  awayTeamId: number;
  awayTeam: Team;
  awayScore: number;
}

export interface Prediction {
  id: string;
  probabilityTeam1: number;
  probabilityTeam2: number;
  expectedScoreTeam1: number;
  expectedScoreTeam2: number;
  confidence: number;
  factors?: any;
  team1Id: number;
  team2Id: number;
  team1?: Team;
  team2?: Team;
  createdAt: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

// Маппинг ID команд к названиям и аббревиатурам (на основе данных из БД)
const TEAM_MAP: Record<number, { name: string; abbrev: string }> = {
  1610612742: { name: "Dallas Mavericks", abbrev: "DAL" },
  1610612747: { name: "Los Angeles Lakers", abbrev: "LAL" },
  1610612757: { name: "Portland Trail Blazers", abbrev: "POR" },
  1610612762: { name: "Utah Jazz", abbrev: "UTA" },
  1610612749: { name: "Milwaukee Bucks", abbrev: "MIL" },
  1610612760: { name: "Oklahoma City Thunder", abbrev: "OKC" },
  1610612744: { name: "Golden State Warriors", abbrev: "GSW" },
  1610612748: { name: "Miami Heat", abbrev: "MIA" },
  1610612738: { name: "Boston Celtics", abbrev: "BOS" },
  1610612746: { name: "LA Clippers", abbrev: "LAC" },
  1610612756: { name: "Phoenix Suns", abbrev: "PHX" },
  1610612759: { name: "San Antonio Spurs", abbrev: "SAS" },
  1610612761: { name: "Toronto Raptors", abbrev: "TOR" },
  1610612764: { name: "Washington Wizards", abbrev: "WAS" },
  1610612741: { name: "Chicago Bulls", abbrev: "CHI" },
  1610612739: { name: "Cleveland Cavaliers", abbrev: "CLE" },
  1610612745: { name: "Houston Rockets", abbrev: "HOU" },
  1610612763: { name: "Memphis Grizzlies", abbrev: "MEM" },
  1610612754: { name: "Indiana Pacers", abbrev: "IND" },
  1610612743: { name: "Denver Nuggets", abbrev: "DEN" },
  1610612753: { name: "Orlando Magic", abbrev: "ORL" },
  1610612755: { name: "Philadelphia 76ers", abbrev: "PHI" },
  1610612758: { name: "Sacramento Kings", abbrev: "SAC" },
  1610612765: { name: "Detroit Pistons", abbrev: "DET" },
  1610612740: { name: "New Orleans Pelicans", abbrev: "NOP" },
  1610612752: { name: "New York Knicks", abbrev: "NYK" },
  1610612751: { name: "Brooklyn Nets", abbrev: "BKN" },
  1610612766: { name: "Charlotte Hornets", abbrev: "CHA" },
  1610612737: { name: "Atlanta Hawks", abbrev: "ATL" },
  1610612750: { name: "Minnesota Timberwolves", abbrev: "MIN" },
  // Добавьте остальные команды по мере необходимости
};

// Вспомогательные функции для получения данных команд
const getTeamInfo = (teamId: number): { name: string; abbrev: string } => {
  return TEAM_MAP[teamId] || {
    name: `Team ${teamId}`,
    abbrev: `T${teamId}`
  };
};

// Преобразование данных команд из API в формат Team
const transformTeam = (apiTeam: any): Team => {
  return {
    id: apiTeam.id,
    name: apiTeam.name || apiTeam.full_name || `Team ${apiTeam.id}`,
    abbrev: apiTeam.abbrev || apiTeam.name?.substring(0, 3).toUpperCase() || `T${apiTeam.id}`,
    fullName: apiTeam.full_name || apiTeam.name || `Team ${apiTeam.id}`,
    nickname: apiTeam.nickname || "",
    city: apiTeam.city || "",
    arena: apiTeam.arena || "",
    foundedYear: apiTeam.founded_year || 0,
    championships: apiTeam.championships || 0,
    wins: apiTeam.wins || 0,
    losses: apiTeam.losses || 0,
    pointsPerGame: apiTeam.points_per_game || 0,
    pointsAgainst: apiTeam.points_against || 0,
    conferenceId: apiTeam.conference_id || 0,
    divisionId: apiTeam.division_id || 0,
  };
};

// Преобразование данных матчей из API в формат Match
const transformMatch = (apiMatch: any, teamsCache: Record<number, Team> = {}): Match => {
  const homeTeamId = apiMatch.home_team_id || apiMatch.homeTeam?.id;
  const awayTeamId = apiMatch.away_team_id || apiMatch.awayTeam?.id;

  // Получаем или создаем команды
  const getTeam = (teamId: number): Team => {
    if (teamsCache[teamId]) return teamsCache[teamId];

    const teamInfo = getTeamInfo(teamId);
    return {
      id: teamId,
      name: teamInfo.name,
      abbrev: teamInfo.abbrev,
      fullName: teamInfo.name,
      nickname: "",
      city: teamInfo.name.split(' ').pop() || "",
      arena: `${teamInfo.name} Arena`,
      foundedYear: 0,
      championships: 0,
      wins: 0,
      losses: 0,
      pointsPerGame: 0,
      pointsAgainst: 0,
      conferenceId: 0,
      divisionId: 0,
    };
  };

  return {
    id: apiMatch.id,
    date: apiMatch.date,
    status: apiMatch.status || "scheduled",
    homeTeamId: homeTeamId,
    homeTeam: getTeam(homeTeamId),
    homeScore: apiMatch.home_score || apiMatch.homeScore || 0,
    awayTeamId: awayTeamId,
    awayTeam: getTeam(awayTeamId),
    awayScore: apiMatch.away_score || apiMatch.awayScore || 0,
  };
};

// Преобразование данных прогнозов из API в формат Prediction
const transformPrediction = (apiPred: any, teamsCache: Record<number, Team> = {}): Prediction => {
  const getTeam = (teamId: number): Team | undefined => {
    if (!teamId) return undefined;
    if (teamsCache[teamId]) return teamsCache[teamId];

    const teamInfo = getTeamInfo(teamId);
    return {
      id: teamId,
      name: teamInfo.name,
      abbrev: teamInfo.abbrev,
      fullName: teamInfo.name,
      nickname: "",
      city: teamInfo.name.split(' ').pop() || "",
      arena: `${teamInfo.name} Arena`,
      foundedYear: 0,
      championships: 0,
      wins: 0,
      losses: 0,
      pointsPerGame: 0,
      pointsAgainst: 0,
      conferenceId: 0,
      divisionId: 0,
    };
  };

  return {
    id: apiPred.id?.toString() || crypto.randomUUID(),
    probabilityTeam1: apiPred.probabilityTeam1 || apiPred.probability_team1 || 0,
    probabilityTeam2: apiPred.probabilityTeam2 || apiPred.probability_team2 || 0,
    expectedScoreTeam1: apiPred.expectedScoreTeam1 || apiPred.expected_score_team1 || 0,
    expectedScoreTeam2: apiPred.expectedScoreTeam2 || apiPred.expected_score_team2 || 0,
    confidence: apiPred.confidence || 0,
    factors: apiPred.factors,
    team1Id: apiPred.team1Id || apiPred.team1_id,
    team2Id: apiPred.team2Id || apiPred.team2_id,
    team1: getTeam(apiPred.team1Id || apiPred.team1_id),
    team2: getTeam(apiPred.team2Id || apiPred.team2_id),
    createdAt: apiPred.createdAt || apiPred.created_at || new Date().toISOString(),
  };
};

// Кеш для команд
let teamsCache: Record<number, Team> = {};

// Универсальная функция запроса
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options?.headers || {}),
  };

  try {
    console.log(`📡 Запрос к ${API_BASE}${endpoint}`, options?.method || 'GET');

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const responseText = await res.text();
    console.log(`📦 Ответ от ${endpoint}:`, responseText);

    if (!res.ok) {
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || errorData.detail || `HTTP Error ${res.status}`);
      } catch {
        throw new Error(`HTTP Error ${res.status}: ${responseText}`);
      }
    }

    // Парсим JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Ошибка парсинга JSON:', responseText);
      throw new Error('Неверный формат ответа от сервера');
    }

    // Преобразуем данные в зависимости от эндпоинта
    if (endpoint === '/teams' || endpoint === '/teams/') {
      // Преобразуем команды и обновляем кеш
      const teams = Array.isArray(data) ? data.map(transformTeam) : [];
      teams.forEach(team => { teamsCache[team.id] = team; });
      return teams as T;
    }

    if (endpoint.includes('/matches')) {
      // Если это запрос матчей, сначала загружаем команды если нужно
      if (Object.keys(teamsCache).length === 0) {
        try {
          const teamsData = await apiRequest<any[]>('/teams');
          // teamsCache уже обновится через рекурсивный вызов
        } catch (e) {
          console.warn('Не удалось загрузить команды для матчей', e);
        }
      }

      const matches = Array.isArray(data)
        ? data.map(m => transformMatch(m, teamsCache))
        : transformMatch(data, teamsCache);

      return matches as T;
    }

    if (endpoint.includes('/predictions') || endpoint.includes('/predict')) {
      const predictions = Array.isArray(data)
        ? data.map(p => transformPrediction(p, teamsCache))
        : transformPrediction(data, teamsCache);

      return predictions as T;
    }

    return data as T;

  } catch (err) {
    console.error(`❌ API Error (${endpoint}):`, err);
    throw err;
  }
}

// Функция для очистки кеша (может пригодиться)
export function clearTeamsCache() {
  teamsCache = {};
}