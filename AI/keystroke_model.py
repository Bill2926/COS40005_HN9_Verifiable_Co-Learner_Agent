"""Portable offline classifier for the synthetic editor window task."""

from pathlib import Path

import numpy as np
from scipy.special import expit
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from keystroke_data import FEATURE_NAMES, SEED


MODEL_PATH = Path(__file__).resolve().parent / "keystroke-activity-model.npz"
MODEL_FORMAT = 1
PREDICTION_THRESHOLD = 0.5


def build_model() -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", LogisticRegression(solver="liblinear", random_state=SEED)),
    ])


def export_model(
    model: Pipeline, path: Path = MODEL_PATH, *, threshold: float = PREDICTION_THRESHOLD
) -> None:
    scaler = model.named_steps["scaler"]
    classifier = model.named_steps["classifier"]
    if not np.array_equal(classifier.classes_, [0, 1]):
        raise ValueError("Expected a fitted binary classifier with classes 0 and 1.")
    np.savez_compressed(
        path,
        format_version=MODEL_FORMAT,
        mean=scaler.mean_,
        scale=scaler.scale_,
        coefficients=classifier.coef_[0],
        intercept=classifier.intercept_[0],
        threshold=threshold,
    )


def score_windows(
    features: np.ndarray, path: Path = MODEL_PATH
) -> tuple[np.ndarray, float]:
    if features.ndim != 2 or features.shape[1] != len(FEATURE_NAMES):
        raise ValueError("Expected one row per window in FEATURE_NAMES order.")
    with np.load(path, allow_pickle=False) as archive:
        if archive["format_version"].item() != MODEL_FORMAT:
            raise ValueError("Unsupported model artifact format.")
        normalized = (features - archive["mean"]) / archive["scale"]
        scores = expit(normalized @ archive["coefficients"] + archive["intercept"].item())
        return scores, archive["threshold"].item()
