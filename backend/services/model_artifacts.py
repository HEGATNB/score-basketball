"""One in-memory snapshot of the trusted model files per API process."""

from dataclasses import dataclass
import logging
from pathlib import Path
import pickle
from typing import Any

import numpy as np
import pandas as pd

from config import config

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ModelArtifacts:
    model: Any
    scalers: tuple
    team_emas: dict
    teams: pd.DataFrame | None

    def scale(self, home, away):
        if len(self.scalers) == 2:
            return np.hstack([self.scalers[0].transform(home), self.scalers[1].transform(away)])
        return self.scalers[0].transform(np.hstack([home, away]))


artifacts: ModelArtifacts | None = None


def reload_artifacts() -> bool:
    global artifacts
    directory = Path(config.MODEL_DIR)
    model_path = directory / "model.h5"
    if not model_path.is_file():
        return False
    try:
        from tensorflow.keras.models import load_model

        scaler_paths = [directory / "scaler_home.pkl", directory / "scaler_away.pkl"]
        if not all(path.is_file() for path in scaler_paths):
            scaler_paths = [directory / "scaler.pkl"]
        scalers = tuple(pickle.loads(path.read_bytes()) for path in scaler_paths)
        team_emas = pickle.loads((directory / "team_emas.pkl").read_bytes())
        teams_path = directory / "teams.csv"
        teams = pd.read_csv(teams_path) if teams_path.is_file() else None
        model = load_model(model_path, compile=False)
        artifacts = ModelArtifacts(model, scalers, team_emas, teams)
        return True
    except Exception:
        logger.exception("Could not load prediction artifacts")
        return False
