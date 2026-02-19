import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.preprocessing import StandardScaler
import pickle
import os
import requests
from bs4 import BeautifulSoup
import time

# ---------------------------
# Configuration
# ---------------------------
DB_PATH = "../nba.sqlite"
MODEL_DIR = "../models"
os.makedirs(MODEL_DIR, exist_ok=True)

# Stats to use for each team (must exist in game table)
STATS = [
    'pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf',
    'fg_pct', 'fg3_pct', 'ft_pct'
]

# EMA smoothing factor (alpha = 2/(N+1), N ~ 10 games)
ALPHA = 0.18  # corresponds to ~10 game half-life

# Sample weight decay (in days)
WEIGHT_DECAY_DAYS = 500

# Minimum number of games to use for training (skip very first games)
MIN_GAMES = 5

# ---------------------------
# Data Loading & Preprocessing
# ---------------------------
def load_games(db_path):
    """Load game table from SQLite."""
    conn = sqlite3.connect(db_path)
    query = "SELECT * FROM game ORDER BY game_date"
    df = pd.read_sql_query(query, conn)
    conn.close()
    return df

def compute_global_averages(df):
    """
    Compute global average for each stat from all team performances.
    Looks for columns like 'pts_home' and 'pts_away'.
    """
    global_avg = {}
    for stat in STATS:
        home_col = f'{stat}_home'
        away_col = f'{stat}_away'
        values = []
        if home_col in df.columns:
            values.append(pd.to_numeric(df[home_col], errors='coerce'))
        if away_col in df.columns:
            values.append(pd.to_numeric(df[away_col], errors='coerce'))
        if values:
            combined = pd.concat(values, ignore_index=True).dropna()
            if not combined.empty:
                global_avg[stat] = combined.mean()
            else:
                global_avg[stat] = 0.0
        else:
            global_avg[stat] = 0.0
    return global_avg

def preprocess_and_build_dataset(df):
    """
    Iterate through games in chronological order.
    For each game, use current EMA of home and away as features,
    then update EMA with actual game stats.
    Returns X, y, sample_weights, and final team_emas.
    """
    df = df.sort_values('game_date').reset_index(drop=True)
    # Convert date to datetime
    df['game_date'] = pd.to_datetime(df['game_date'])

    # Fill missing numeric stats with 0
    for stat in STATS:
        home_col = f'{stat}_home'
        away_col = f'{stat}_away'
        if home_col in df.columns:
            df[home_col] = pd.to_numeric(df[home_col], errors='coerce').fillna(0)
        else:
            df[home_col] = 0  # Create column if missing
        if away_col in df.columns:
            df[away_col] = pd.to_numeric(df[away_col], errors='coerce').fillna(0)
        else:
            df[away_col] = 0
    # Global averages for initialization
    global_avg = compute_global_averages(df)

    # Prepare containers
    features = []
    targets = []
    weights = []
    game_dates = []

    # EMA state per team: dict of {team_id: {stat: value}}
    team_emas = {}

    # For weight calculation, use the most recent game date as "now"
    last_date = df['game_date'].max()

    for idx, row in df.iterrows():
        home_id = str(row['team_id_home'])
        away_id = str(row['team_id_away'])
        game_date = row['game_date']

        # Initialize team EMAs if not present
        if home_id not in team_emas:
            team_emas[home_id] = global_avg.copy()
        if away_id not in team_emas:
            team_emas[away_id] = global_avg.copy()

        # Get current EMAs (pre-game)
        home_ema = team_emas[home_id]
        away_ema = team_emas[away_id]

        # Build feature vector: concatenate home and away stats in fixed order
        feat = []
        for stat in STATS:
            feat.append(home_ema[stat])
        for stat in STATS:
            feat.append(away_ema[stat])
        features.append(feat)

        # Target: 1 if home win, else 0
        target = 1 if row['wl_home'] == 'W' else 0
        targets.append(target)

        # Sample weight based on recency
        days_old = (last_date - game_date).days
        weight = np.exp(-days_old / WEIGHT_DECAY_DAYS)
        weights.append(weight)
        game_dates.append(game_date)

        # After the game, update home team's EMA with actual stats
        actual_home = {}
        for stat in STATS:
            col = f'{stat}_home'
            val = row[col] if col in row else 0
            if pd.isna(val):
                val = 0
            actual_home[stat] = val
        # Update EMA
        new_home_ema = {}
        for stat in STATS:
            new_home_ema[stat] = ALPHA * actual_home[stat] + (1 - ALPHA) * home_ema[stat]
        team_emas[home_id] = new_home_ema

        # Update away team's EMA
        actual_away = {}
        for stat in STATS:
            col = f'{stat}_away'
            val = row[col] if col in row else 0
            if pd.isna(val):
                val = 0
            actual_away[stat] = val
        new_away_ema = {}
        for stat in STATS:
            new_away_ema[stat] = ALPHA * actual_away[stat] + (1 - ALPHA) * away_ema[stat]
        team_emas[away_id] = new_away_ema

    X = np.array(features)
    y = np.array(targets)
    weights = np.array(weights)

    # Optional: filter out games with very few prior games? (We used global avg, so all included)
    return X, y, weights, team_emas, game_dates

# ---------------------------
# Model Definition
# ---------------------------
def build_model(input_dim):
    model = keras.Sequential([
        layers.Dense(64, activation='relu', input_shape=(input_dim,)),
        layers.Dropout(0.3),
        layers.Dense(32, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(16, activation='relu'),
        layers.Dense(1, activation='sigmoid')
    ])
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    return model

# ---------------------------
# Training Pipeline
# ---------------------------
def train_model(db_path):
    print("Loading data...")
    df = load_games(db_path)
    print(f"Total games: {len(df)}")

    print("Preprocessing and building dataset with EMA...")
    X, y, weights, team_emas, game_dates = preprocess_and_build_dataset(df)
    print(f"Dataset size: {X.shape}")

    # Train/val split based on time (80% oldest, 20% newest)
    split_idx = int(0.8 * len(X))
    X_train, X_val = X[:split_idx], X[split_idx:]
    y_train, y_val = y[:split_idx], y[split_idx:]
    w_train, w_val = weights[:split_idx], weights[split_idx:]

    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)

    # Build model
    model = build_model(X.shape[1])
    model.summary()

    # Train with sample weights
    history = model.fit(
        X_train_scaled, y_train,
        sample_weight=w_train,
        validation_data=(X_val_scaled, y_val, w_val),
        epochs=30,
        batch_size=64,
        verbose=1
    )

    # Evaluate
    val_loss, val_acc = model.evaluate(X_val_scaled, y_val, sample_weight=w_val)
    print(f"Validation accuracy: {val_acc:.4f}")

    # Save model, scaler, and team EMAs
    model.save(os.path.join(MODEL_DIR, "model.h5"))
    with open(os.path.join(MODEL_DIR, "scaler.pkl"), "wb") as f:
        pickle.dump(scaler, f)
    with open(os.path.join(MODEL_DIR, "team_emas.pkl"), "wb") as f:
        pickle.dump(team_emas, f)

    # Also save team names mapping (from game table)
    conn = sqlite3.connect(db_path)
    teams_df = pd.read_sql_query("SELECT DISTINCT team_id_home as team_id, team_name_home as team_name, team_abbreviation_home as team_abbrev FROM game", conn)
    conn.close()
    teams_df.to_csv(os.path.join(MODEL_DIR, "teams.csv"), index=False)

    print("Model and artifacts saved.")

    return model, scaler, team_emas

# ---------------------------
# Retraining with New Data
# ---------------------------
def fetch_new_games_from_espn(season=None):
    """
    Placeholder: scrape recent games from ESPN.
    Implement actual scraping using requests+BeautifulSoup.
    Should return a list of dicts matching the game table structure.
    """
    print("Fetching new games from ESPN...")
    # Example stub: return empty list
    return []

def update_model_with_new_data(db_path, new_games_df):
    """
    Append new games to database and retrain model incrementally or fully.
    For simplicity, we just retrain from scratch.
    """
    # Append to existing DB (you'd need to implement insertion)
    # Then call train_model again
    pass

# ---------------------------
# Main
# ---------------------------
if __name__ == "__main__":
    train_model(DB_PATH)
    # Uncomment to simulate retraining:
    # new_data = fetch_new_games_from_espn()
    # if new_data:
    #     update_model_with_new_data(DB_PATH, new_data)