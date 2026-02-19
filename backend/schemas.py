from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List

# User schemas
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: Optional[str] = "user"

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# Team schemas
class TeamBase(BaseModel):
    name: str
    abbrev: str = Field(..., min_length=2, max_length=3)
    full_name: str
    nickname: Optional[str] = None
    city: Optional[str] = None
    arena: Optional[str] = None
    founded_year: Optional[int] = None

class TeamCreate(TeamBase):
    conference_id: int
    division_id: int

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    nickname: Optional[str] = None
    arena: Optional[str] = None
    championships: Optional[int] = None

class TeamResponse(TeamBase):
    id: int
    conference_id: int
    division_id: int
    championships: int
    wins: int
    losses: int
    points_per_game: float
    points_against: float
    
    class Config:
        from_attributes = True

# Match schemas
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
    created_by_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Prediction schemas
class PredictionRequest(BaseModel):
    team1_id: int
    team2_id: int

class PredictionResponse(BaseModel):
    id: int
    team1_id: int
    team2_id: int
    probability_team1: float
    probability_team2: float
    predicted_winner_id: int
    home_score_predicted: Optional[int] = None
    away_score_predicted: Optional[int] = None
    confidence: float
    model_version: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ModelEvaluationResponse(BaseModel):
    accuracy: Optional[float]
    message: str

class ModelStatsResponse(BaseModel):
    total_predictions: int
    total_training_data: int
    accuracy: Optional[float]
    model_version: str

# Audit schemas
class AuditLogResponse(BaseModel):
    id: int
    user_id: int
    action: str
    entity: Optional[str]
    details: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True