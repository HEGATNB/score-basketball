import { Team } from "@/entities/team";
import { Match } from "@/entities/match";
import { Prediction } from "@/entities/prediction";

// ТИПЫ БД
export type UserRole = "admin" | "operator" | "client";

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string; // В реальности так нельзя, но для курсовой по фронту - ок
  isBlocked: boolean;
};

export type AuditLog = {
  id: string;
  userId: string;
  userEmail: string;
  action: "create" | "update" | "delete" | "login" | "backup" | "ai_train";
  entity: "team" | "match" | "user" | "system";
  details: string;
  timestamp: string;
};

// НАЧАЛЬНЫЕ ДАННЫЕ (SEED)
const initialTeams: Team[] = [
  { id: 1, name: "ЦСКА", wins: 18, losses: 6, avgPointsFor: 84.2, avgPointsAgainst: 78.9 },
  { id: 2, name: "Зенит", wins: 16, losses: 8, avgPointsFor: 82.1, avgPointsAgainst: 79.5 },
];

const initialUsers: User[] = [
  { id: "1", email: "admin@sys.com", name: "Администратор", role: "admin", passwordHash: "admin", isBlocked: false },
  { id: "2", email: "oper@sys.com", name: "Аналитик", role: "operator", passwordHash: "oper", isBlocked: false },
  { id: "3", email: "user@sys.com", name: "Клиент", role: "client", passwordHash: "user", isBlocked: false },
];

// КЛЮЧИ LOCALSTORAGE
const DB_KEYS = {
  TEAMS: "db_teams",
  MATCHES: "db_matches",
  USERS: "db_users",
  LOGS: "db_logs",
  PREDICTIONS: "db_predictions",
};

// --- API МЕТОДЫ ---

// 1. Инициализация (если база пустая)
export function initDB() {
  if (!localStorage.getItem(DB_KEYS.TEAMS)) {
    localStorage.setItem(DB_KEYS.TEAMS, JSON.stringify(initialTeams));
  }
  if (!localStorage.getItem(DB_KEYS.USERS)) {
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(initialUsers));
  }
  if (!localStorage.getItem(DB_KEYS.MATCHES)) {
    localStorage.setItem(DB_KEYS.MATCHES, JSON.stringify([]));
  }
  if (!localStorage.getItem(DB_KEYS.LOGS)) {
    localStorage.setItem(DB_KEYS.LOGS, JSON.stringify([]));
  }
}

// 2. Универсальный Generic GET
function getCollection<T>(key: string): T[] {
  return JSON.parse(localStorage.getItem(key) || "[]");
}

// 3. АУДИТ (Журнал действий - ТЗ 1.7.1 п.7)
export function logAction(user: User | null, action: AuditLog["action"], entity: AuditLog["entity"], details: string) {
  const logs = getCollection<AuditLog>(DB_KEYS.LOGS);
  const newLog: AuditLog = {
    id: crypto.randomUUID(),
    userId: user?.id || "guest",
    userEmail: user?.email || "guest",
    action,
    entity,
    details,
    timestamp: new Date().toISOString(),
  };
  logs.unshift(newLog); // Новые сверху
  localStorage.setItem(DB_KEYS.LOGS, JSON.stringify(logs));
}

// 4. CRUD ОПЕРАЦИИ (ТЗ 1.7.1 п.3)

// TEAMS
export const dbTeams = {
  getAll: () => getCollection<Team>(DB_KEYS.TEAMS),
  getById: (id: number) => getCollection<Team>(DB_KEYS.TEAMS).find(t => t.id === id),
  create: (team: Team, currentUser: User) => {
    const items = getCollection<Team>(DB_KEYS.TEAMS);
    items.push(team);
    localStorage.setItem(DB_KEYS.TEAMS, JSON.stringify(items));
    logAction(currentUser, "create", "team", `Создана команда: ${team.name}`);
  },
  delete: (id: number, currentUser: User) => {
    let items = getCollection<Team>(DB_KEYS.TEAMS);
    items = items.filter(t => t.id !== id);
    localStorage.setItem(DB_KEYS.TEAMS, JSON.stringify(items));
    logAction(currentUser, "delete", "team", `Удалена команда ID: ${id}`);
  }
};

// MATCHES
export const dbMatches = {
  getAll: () => getCollection<Match>(DB_KEYS.MATCHES),
  create: (match: Match, currentUser: User) => {
    const items = getCollection<Match>(DB_KEYS.MATCHES);
    items.push(match);
    localStorage.setItem(DB_KEYS.MATCHES, JSON.stringify(items));
    logAction(currentUser, "create", "match", `Матч ${match.date}`);
  }
};

// USERS (Auth)
export const dbUsers = {
  findByEmail: (email: string) => getCollection<User>(DB_KEYS.USERS).find(u => u.email === email),
  getAll: () => getCollection<User>(DB_KEYS.USERS),
};

// LOGS
export const dbLogs = {
  getAll: () => getCollection<AuditLog>(DB_KEYS.LOGS),
};

// 5. БЭКАП И ВОССТАНОВЛЕНИЕ (ТЗ 1.9.2)
export function createBackup() {
  const backup = {
    teams: getCollection(DB_KEYS.TEAMS),
    matches: getCollection(DB_KEYS.MATCHES),
    users: getCollection(DB_KEYS.USERS),
    logs: getCollection(DB_KEYS.LOGS),
    date: new Date().toISOString(),
  };
  // В реальности это скачивание файла, для курсовой - возврат JSON
  return JSON.stringify(backup, null, 2);
}

export function restoreBackup(json: string, currentUser: User) {
  try {
    const data = JSON.parse(json);
    if (data.teams) localStorage.setItem(DB_KEYS.TEAMS, JSON.stringify(data.teams));
    if (data.matches) localStorage.setItem(DB_KEYS.MATCHES, JSON.stringify(data.matches));
    if (data.users) localStorage.setItem(DB_KEYS.USERS, JSON.stringify(data.users));
    logAction(currentUser, "backup", "system", "Восстановление базы данных");
    return true;
  } catch (e) {
    return false;
  }
}
