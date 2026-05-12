from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List

class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    username: Optional[str] = None
    role: Optional[str] = "user"


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    identifier: str
    password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime
    is_blocked: bool = False

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    user: UserResponse

    class Config:
        from_attributes = True
        populate_by_name = True


class TeamBase(BaseModel):
    name: str
    abbrev: str = Field(..., min_length=2, max_length=3)
    full_name: str
    nickname: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    arena: Optional[str] = None
    founded_year: Optional[int] = None


class PlayerBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: str
    number: Optional[str] = None
    position: Optional[str] = None
    height: Optional[str] = None
    weight: Optional[float] = None
    birth_date: Optional[str] = None
    country: Optional[str] = None
    team_abbrev: Optional[str] = None
    team_name: Optional[str] = None
    team_city: Optional[str] = None

    # Статистика
    season: Optional[str] = None
    seasons: Optional[List[str]] = None
    points_per_game: float = 0
    rebounds_per_game: float = 0
    assists_per_game: float = 0
    minutes_per_game: Optional[float] = None
    games_played: Optional[int] = None
    age: Optional[int] = None

    # Продвинутая статистика
    usage_rate: Optional[float] = None
    true_shooting: Optional[float] = None
    net_rating: Optional[float] = None
    assist_percentage: Optional[float] = None
    offensive_rebound_pct: Optional[float] = None
    defensive_rebound_pct: Optional[float] = None

    # Информация о драфте
    draft_year: Optional[str] = None
    draft_round: Optional[str] = None
    draft_number: Optional[str] = None
    college: Optional[str] = None


class PlayerResponse(PlayerBase):
    id: int

    class Config:
        from_attributes = True


class TeamCreate(TeamBase):
    conference_id: Optional[int] = None
    division_id: Optional[int] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    nickname: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    arena: Optional[str] = None
    founded_year: Optional[int] = None
    championships: Optional[int] = None
    head_coach: Optional[str] = None
    general_manager: Optional[str] = None
    owner: Optional[str] = None


class TeamResponse(TeamBase):
    id: int
    conference_id: Optional[int] = None
    division_id: Optional[int] = None
    conference: Optional[str] = None
    division: Optional[str] = None
    championships: int = 0
    wins: int = 0
    losses: int = 0
    win_pct: float = 0
    points_per_game: float = 0
    points_against: float = 0
    rebounds_per_game: float = 0
    assists_per_game: float = 0
    arena_capacity: Optional[int] = None
    head_coach: Optional[str] = None
    general_manager: Optional[str] = None
    owner: Optional[str] = None

    class Config:
        from_attributes = True


# Match schemas
class TeamInfo(BaseModel):
    id: int
    name: str
    abbrev: str


class MatchBase(BaseModel):
    date: datetime
    status: str = "scheduled"
    home_team_id: int
    away_team_id: int


class MatchCreate(MatchBase):
    pass


class MatchResultUpdate(BaseModel):
    home_score: int
    away_score: int


class MatchResponse(MatchBase):
    id: int
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    home_team: TeamInfo
    away_team: TeamInfo
    season: Optional[str] = None
    season_type: Optional[str] = None

    class Config:
        from_attributes = True


# Prediction schemas
class PredictionRequest(BaseModel):
    team1_id: int = Field(..., alias="team1Id")
    team2_id: int = Field(..., alias="team2Id")

    class Config:
        populate_by_name = True


class PredictionResponse(BaseModel):
    id: str
    probabilityTeam1: float
    probabilityTeam2: float
    expectedScoreTeam1: int
    expectedScoreTeam2: int
    confidence: float
    team1Id: int
    team2Id: int
    team1: TeamInfo
    team2: TeamInfo
    createdAt: str
    modelVersion: str


class ModelEvaluationResponse(BaseModel):
    accuracy: Optional[float]
    message: str


class ModelStatsResponse(BaseModel):
    totalPredictions: int
    totalUsers: int
    totalTrainingGames: int
    accuracy: Optional[float]
    modelVersion: str
    lastUpdated: str


class AuditLogResponse(BaseModel):
    id: str
    action: str
    entity: Optional[str]
    details: Optional[dict]
    createdAt: str
    user: Optional[dict]

    class Config:
        from_attributes = True


class BackupResponse(BaseModel):
    id: str
    filename: str
    size: int
    type: str
    status: str
    createdAt: Optional[str]

    class Config:
        from_attributes = True