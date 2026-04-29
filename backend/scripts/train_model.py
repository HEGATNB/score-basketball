import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
import numpy as np
from datetime import datetime
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, regularizers, callbacks
from sklearn.preprocessing import StandardScaler
import pickle
import os
import sys
import time
import json
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
env_path = BASE_DIR / 'env'

print(f"Поиск env файла по пути: {env_path}")

if env_path.exists():
    load_dotenv(env_path)
    print("env файл загружен")
else:
    print("env файл не найден!")

DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

# Директория для сохранения моделей

MODEL_DIR = BASE_DIR / "models"
os.makedirs(MODEL_DIR, exist_ok=True)

# Проверка наличия всех необходимых параметров

if not all([DB_NAME, DB_USER, DB_PASSWORD]):
    print("\nОШИБКА: Не все параметры БД заданы!")
    sys.exit(1)

# Альтернативный путь для моделей из env

MODEL_DIR = os.getenv("MODEL_DIR", str(BASE_DIR / "models"))
os.makedirs(MODEL_DIR, exist_ok=True)

# Список статистических показателей для анализа

STATS = [
    'pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf',
    'fg_pct', 'fg3_pct', 'ft_pct'
]

# Параметры экспоненциального сглаживания (EMA)

ALPHA = 0.18  # Коэффициент сглаживания
WEIGHT_DECAY_DAYS = 500  # Период полураспада весов (в днях)


def get_db_connection():
    print(f"\nПопытка подключения к БД...")
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
            cursor_factory=RealDictCursor
        )
        print("Подключение успешно!")
        return conn
    except Exception as e:
        print(f"Ошибка подключения: {e}")
        raise

    '''   
     Сохраняет метрики модели в базу данных

    Параметры:
    - model_version: версия модели (например, "1.0.0")
    - training_games_count: количество игр в обучающей выборке
    - accuracy: точность на обучающей выборке
    - loss: функция потерь на обучающей выборке
    - validation_accuracy: точность на валидационной выборке
    - validation_loss: функция потерь на валидационной выборке
    - features_count: количество признаков
    - training_duration_seconds: длительность обучения в секундах
    - status: статус ('completed', 'failed', 'in_progress')
    - error_message: сообщение об ошибке (если есть)
    - metadata: дополнительные метаданные в формате JSON
    '''


def save_model_metrics_to_db(
        model_version: str,
        training_games_count: int,
        accuracy: float,
        loss: float,
        validation_accuracy: float,
        validation_loss: float,
        features_count: int,
        training_duration_seconds: float,
        status: str = 'completed',
        error_message: str = None,
        metadata: dict = None
):
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        cursor = conn.cursor()

        # Создаем таблицу, если её нет
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS model_metrics (
                id SERIAL PRIMARY KEY,
                model_version VARCHAR(50) NOT NULL,
                training_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                training_games_count INTEGER,
                accuracy FLOAT,
                loss FLOAT,
                validation_accuracy FLOAT,
                validation_loss FLOAT,
                features_count INTEGER,
                training_duration_seconds FLOAT,
                status VARCHAR(20) DEFAULT 'completed',
                error_message TEXT,
                metadata JSONB
            )
        """)
        conn.commit()

        # Подготавливаем метаданные
        if metadata is None:
            metadata = {}

        metadata['alpha'] = ALPHA
        metadata['weight_decay_days'] = WEIGHT_DECAY_DAYS

        # Вставляем запись
        cursor.execute("""
            INSERT INTO model_metrics (
                model_version,
                training_date,
                training_games_count,
                accuracy,
                loss,
                validation_accuracy,
                validation_loss,
                features_count,
                training_duration_seconds,
                status,
                error_message,
                metadata
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            model_version,
            datetime.now(),
            training_games_count,
            accuracy,
            loss,
            validation_accuracy,
            validation_loss,
            features_count,
            training_duration_seconds,
            status,
            error_message,
            json.dumps(metadata)
        ))

        conn.commit()
        cursor.close()
        conn.close()
        print(f"Метрики сохранены в БД: validation_accuracy={validation_accuracy:.4f}")
        return True
    except Exception as e:
        print(f"Ошибка сохранения метрик: {e}")
        import traceback
        traceback.print_exc()
        return False


# Парсер дат

def safe_parse_date(date_val):
    if pd.isna(date_val) or date_val is None:
        return None

    try:

        # Если это уже datetime, возвращаем как есть

        if isinstance(date_val, datetime):
            return date_val

        # Если это строка

        if isinstance(date_val, str):
            date_val = date_val.strip()

            # Проверяем, что это не название колонки

            if date_val.lower() == 'game_date':
                return None

            if ' ' in date_val and '-' in date_val:
                return datetime.strptime(date_val, "%Y-%m-%d %H:%M:%S")

            elif '-' in date_val and len(date_val) == 10:
                return datetime.strptime(date_val, "%Y-%m-%d")

            else:
                return pd.to_datetime(date_val)

        return None
    except Exception as e:
        print(f"Не удалось распарсить дату '{date_val}': {e}")
        return None

    '''   
    Загружает данные об играх из базы данных
    Возвращает DataFrame с играми, отсортированными по дате
    '''


def load_games():
    conn = get_db_connection()

    cursor = conn.cursor()
    cursor.execute("SELECT * FROM game ORDER BY game_date")

    colnames = [desc[0] for desc in cursor.description]
    print(f"Колонки: {colnames[:10]}")

    rows = cursor.fetchall()
    print(f"Загружено {len(rows)} строк из бд")

    df = pd.DataFrame(rows, columns=colnames)

    cursor.close()
    conn.close()

    print(f"Размер фрейма данных: {df.shape}")

    df['game_date_parsed'] = df['game_date'].apply(safe_parse_date)
    success_count = df['game_date_parsed'].notna().sum()

    if success_count == 0:
        print("Нет распаршенных дат")
        return pd.DataFrame()

    before = len(df)
    df = df.dropna(subset=['game_date_parsed'])
    after = len(df)

    if before > after:
        print(f"Удалено {before - after} строк с некорректными датами")

    df['game_date'] = df['game_date_parsed']
    df = df.drop(columns=['game_date_parsed'])
    df = df.sort_values('game_date').reset_index(drop=True)

    if len(df) > 0:
        print(f"Диапазон дат: {df['game_date'].min()} - {df['game_date'].max()}")
        print(f"Итоговое количество игр: {len(df)}")

    return df

    '''   
    Вычисляет глобальные средние значения для всех статистических показателей
    Используется для инициализации EMA новых команд
    '''


def compute_global_averages(df):
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

    '''   
    Предобработка данных и построение датасета для обучения

    Создает признаки на основе EMA (экспоненциального скользящего среднего)
    для каждой команды и целевую переменную (победа хозяев: 1/0)
    '''


def preprocess_and_build_dataset(df):
    print("Предобработка данных...")

    for stat in STATS:
        home_col = f'{stat}_home'
        away_col = f'{stat}_away'

        if home_col in df.columns:
            df[home_col] = pd.to_numeric(df[home_col], errors='coerce').fillna(0)
        else:
            df[home_col] = 0

        if away_col in df.columns:
            df[away_col] = pd.to_numeric(df[away_col], errors='coerce').fillna(0)
        else:
            df[away_col] = 0

    global_avg = compute_global_averages(df)

    features = []
    targets = []
    weights = []
    game_dates = []
    team_emas = {}

    last_date = df['game_date'].max()

    print("Построение сета данных...")
    total_games = len(df)

    for idx, row in df.iterrows():
        if idx % 10000 == 0:
            print(f"  ... обработано {idx}/{total_games} игр")

        home_id = str(row['team_id_home'])
        away_id = str(row['team_id_away'])
        game_date = row['game_date']

        if home_id not in team_emas:
            team_emas[home_id] = global_avg.copy()
        if away_id not in team_emas:
            team_emas[away_id] = global_avg.copy()

        home_ema = team_emas[home_id]
        away_ema = team_emas[away_id]

        feat = []
        for stat in STATS:
            feat.append(home_ema[stat])
        for stat in STATS:
            feat.append(away_ema[stat])
        features.append(feat)

        target = 1 if row['wl_home'] == 'W' else 0
        targets.append(target)

        days_old = (last_date - game_date).days
        weight = np.exp(-days_old / WEIGHT_DECAY_DAYS)
        weights.append(weight)
        game_dates.append(game_date)

        actual_home = {}
        for stat in STATS:
            col = f'{stat}_home'
            val = row[col] if col in row else 0
            actual_home[stat] = float(val) if pd.notna(val) else 0

        new_home_ema = {}
        for stat in STATS:
            new_home_ema[stat] = ALPHA * actual_home[stat] + (1 - ALPHA) * home_ema[stat]
        team_emas[home_id] = new_home_ema

        actual_away = {}
        for stat in STATS:
            col = f'{stat}_away'
            val = row[col] if col in row else 0
            actual_away[stat] = float(val) if pd.notna(val) else 0

        new_away_ema = {}
        for stat in STATS:
            new_away_ema[stat] = ALPHA * actual_away[stat] + (1 - ALPHA) * away_ema[stat]
        team_emas[away_id] = new_away_ema

    X = np.array(features, dtype=np.float32)
    y = np.array(targets, dtype=np.float32)
    weights = np.array(weights, dtype=np.float32)

    print(f"Создан датасет: {X.shape[0]} примеров, {X.shape[1]} признаков")
    print(f"Соотношение классов: {np.mean(y):.3f} (доля побед хозяев)")

    return X, y, weights, team_emas, game_dates

#Раздельная Z-нормализация для домашних и гостевых команд
def normalize_features_separate(X_train, X_val):
    n_stats = len(STATS)

    # Разделение признаков на домашние и гостевые
    X_train_home = X_train[:, :n_stats]
    X_train_away = X_train[:, n_stats:]
    X_val_home = X_val[:, :n_stats]
    X_val_away = X_val[:, n_stats:]

    scaler_home = StandardScaler()
    scaler_away = StandardScaler()

    # Нормализация
    X_train_home_scaled = scaler_home.fit_transform(X_train_home)
    X_train_away_scaled = scaler_away.fit_transform(X_train_away)

    X_val_home_scaled = scaler_home.transform(X_val_home)
    X_val_away_scaled = scaler_away.transform(X_val_away)

    # Обьединение признаков
    X_train_scaled = np.hstack([X_train_home_scaled, X_train_away_scaled])
    X_val_scaled = np.hstack([X_val_home_scaled, X_val_away_scaled])

    return X_train_scaled, X_val_scaled, scaler_home, scaler_away

    '''    
    Создает нейронную сеть для бинарной классификации

    Архитектура:
    - Входной слой: input_dim нейронов
    - Скрытые слои: 128 -> 64 -> 32 -> 16 нейронов (ReLU)
    - BatchNormalization для стабильности
    - Dropout для предотвращения переобучения
    - Выходной слой: 1 нейрон (sigmoid для вероятности)
    '''


def build_model(input_dim):
    model = keras.Sequential([
        layers.Dense(128, activation='relu', input_shape=(input_dim,),
                     kernel_regularizer=regularizers.l2(0.001)),
        layers.BatchNormalization(),
        layers.Dropout(0.3),
        layers.Dense(64, activation='relu',
                     kernel_regularizer=regularizers.l2(0.001)),
        layers.BatchNormalization(),
        layers.Dropout(0.3),
        layers.Dense(32, activation='relu'),
        layers.Dropout(0.2),
        layers.Dense(16, activation='relu'),
        layers.Dropout(0.2),
        layers.Dense(1, activation='sigmoid')
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy', keras.metrics.AUC(name='auc')]
    )
    return model

    ''' 
    Основная функция обучения модели

    Этапы:
    1. Загрузка данных из БД
    2. Предобработка и построение датасета
    3. Разделение на обучающую и валидационную выборки
    4. Масштабирование признаков
    5. Создание и обучение нейронной сети
    6. Сохранение модели и артефактов
    7. Сохранение метрик в базу данных
    '''


def train_model():
    start_time = time.time()
    print("Запуск обучения модели")

    try:
        print("Загрузка данных")
        df = load_games()
        print(f"Всего игр: {len(df)}")

        if len(df) == 0:
            print("Нет данных для обучения")
            return None, None, None

        X, y, weights, team_emas, game_dates = preprocess_and_build_dataset(df)

        split_idx = int(0.8 * len(X))
        X_train, X_val = X[:split_idx], X[split_idx:]
        y_train, y_val = y[:split_idx], y[split_idx:]
        w_train, w_val = weights[:split_idx], weights[split_idx:]

        print(f"Обучающая выборка: {len(X_train)} примеров")
        print(f"Валидационная выборка: {len(X_val)} примеров")

        # Раздельная Z-нормализация
        X_train_scaled, X_val_scaled, scaler_home, scaler_away = normalize_features_separate(X_train, X_val)

        model = build_model(X.shape[1])
        model.summary()

        early_stopping = callbacks.EarlyStopping(
            monitor='val_loss',
            patience=15,
            restore_best_weights=True,
            verbose=0
        )

        reduce_lr = callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=1e-6,
            verbose=0
        )

        print("Начало обучения...")
        history = model.fit(
            X_train_scaled, y_train,
            sample_weight=w_train,
            validation_data=(X_val_scaled, y_val, w_val),
            epochs=100,
            batch_size=64,
            callbacks=[early_stopping, reduce_lr],
            verbose=1
        )

        # Оценка на валидационной(частичной) выборке
        val_loss, val_acc, val_auc = model.evaluate(X_val_scaled, y_val, sample_weight=w_val, verbose=0)
        print(f"Точность валидации: {val_acc:.4f}")
        print(f"AUC валидации: {val_auc:.4f}")

        # Оценка на обучающей выборке

        train_loss, train_acc, train_auc = model.evaluate(X_train_scaled, y_train, sample_weight=w_train, verbose=0)
        print(f"Точность обучения: {train_acc:.4f}")
        print(f"Разница Accuracy (train-val): {train_acc - val_acc:.4f}")

        # Сохраняем модель и артефакты

        model_path = os.path.join(MODEL_DIR, "model.h5")
        scaler_home_path = os.path.join(MODEL_DIR, "scaler_home.pkl")
        scaler_away_path = os.path.join(MODEL_DIR, "scaler_away.pkl")
        emas_path = os.path.join(MODEL_DIR, "team_emas.pkl")

        model.save(model_path)
        with open(scaler_home_path, "wb") as f:
            pickle.dump(scaler_home, f)
        with open(scaler_away_path, "wb") as f:
            pickle.dump(scaler_away, f)
        with open(emas_path, "wb") as f:
            pickle.dump(team_emas, f)

        # Сохраняем информацию о командах

        conn = get_db_connection()
        teams_df = pd.read_sql_query("""
            SELECT DISTINCT 
                team_id_home as team_id, 
                team_name_home as team_name, 
                team_abbreviation_home as team_abbrev 
            FROM game 
            WHERE team_id_home IS NOT NULL
        """, conn)
        conn.close()

        teams_path = os.path.join(MODEL_DIR, "teams.csv")
        teams_df.to_csv(teams_path, index=False)

        # Вычисляем длительность обучения

        training_duration = time.time() - start_time
        print(f"Длительность обучения: {training_duration:.2f} секунд")

        # Сохраняем метрики в базу данных

        save_model_metrics_to_db(
            model_version="2.0.0",
            training_games_count=len(X_train),
            accuracy=float(train_acc),
            loss=float(train_loss),
            validation_accuracy=float(val_acc),
            validation_loss=float(val_loss),
            features_count=X.shape[1],
            training_duration_seconds=training_duration,
            status="completed",
            metadata={
                "total_games": len(df),
                "validation_games": len(X_val),
                "alpha": ALPHA,
                "weight_decay_days": WEIGHT_DECAY_DAYS,
                "epochs_completed": len(history.history['loss']),
                "train_auc": float(train_auc),
                "val_auc": float(val_auc),
                "overfitting_gap": float(train_acc - val_acc)
            }
        )

        print(f"Модель и артефакты сохранены в {MODEL_DIR}")
        return model, (scaler_home, scaler_away), team_emas

    except Exception as e:
        training_duration = time.time() - start_time
        error_msg = str(e)
        print(f"Ошибка при обучении модели: {error_msg}")

        try:
            save_model_metrics_to_db(
                model_version="2.0.0",
                training_games_count=0,
                accuracy=0.0,
                loss=0.0,
                validation_accuracy=0.0,
                validation_loss=0.0,
                features_count=0,
                training_duration_seconds=training_duration,
                status="failed",
                error_message=error_msg,
                metadata={"error_type": type(e).__name__}
            )
        except Exception as db_error:
            print(f"Не удалось сохранить информацию об ошибке в БД: {db_error}")

        raise


if __name__ == "__main__":
    train_model()