from hashlib import sha256
from io import BytesIO
import json
from math import isfinite
from pathlib import Path
import re
from zipfile import BadZipFile

from prompt_model import MODEL_FORMAT, PromptModel, load_prompt_model


AI_ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = AI_ROOT / "model-manifest.json"
PROMPT_TASK = "prompt_content"


def load_prompt_artifact(model_dir: Path, manifest_path: Path) -> tuple[dict, PromptModel | None]:
    try:
        metadata = read_prompt_manifest(manifest_path)
    except (OSError, ValueError):
        return {"task": PROMPT_TASK}, None

    try:
        data = (model_dir / metadata["artifact"]).read_bytes()
        if sha256(data).hexdigest() != metadata["sha256"]:
            return metadata, None
        model = load_prompt_model(BytesIO(data))
        if model.threshold != metadata["threshold"]:
            return metadata, None
    except (OSError, ValueError, KeyError, EOFError, BadZipFile):
        return metadata, None
    return metadata, model


def read_prompt_manifest(path: Path) -> dict:
    metadata = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(metadata, dict):
        raise ValueError("Expected a prompt model manifest.")
    expected_fields = {
        "task": PROMPT_TASK,
        "artifact": "self-harm-text-model.npz",
        "formatVersion": MODEL_FORMAT,
        "featureVersion": "hashed-char-tfidf-v1",
        "language": "en",
        "positiveLabel": "sh_content",
        "negativeLabel": "other_content",
    }
    for key, value in expected_fields.items():
        if type(metadata.get(key)) is not type(value) or metadata[key] != value:
            raise ValueError(f"Unsupported prompt model field: {key}.")
    for key in ("modelVersion", "featureDescription", "meaning", "evaluationStatus"):
        if not isinstance(metadata.get(key), str) or not metadata[key].strip():
            raise ValueError(f"Missing prompt model field: {key}.")
    checksum = metadata.get("sha256")
    if not isinstance(checksum, str) or not re.fullmatch(r"[0-9a-f]{64}", checksum):
        raise ValueError("Invalid prompt model checksum.")
    if not unit_number(metadata.get("threshold")):
        raise ValueError("Invalid prompt model threshold.")
    evaluation = metadata.get("evaluation")
    if not isinstance(evaluation, dict):
        raise ValueError("Missing prompt model evaluation.")
    for key in ("dataset", "revision"):
        if not isinstance(evaluation.get(key), str) or not evaluation[key].strip():
            raise ValueError(f"Missing prompt evaluation field: {key}.")
    for key in ("holdoutCount", "positiveCount"):
        if type(evaluation.get(key)) is not int or evaluation[key] < 0:
            raise ValueError(f"Invalid prompt evaluation count: {key}.")
    if evaluation["positiveCount"] > evaluation["holdoutCount"]:
        raise ValueError("The positive count exceeds the holdout size.")
    for key in ("averagePrecision", "constantScoreAveragePrecision", "precision", "recall", "f1"):
        if not unit_number(evaluation.get(key)):
            raise ValueError(f"Invalid prompt evaluation metric: {key}.")
    return metadata


def unit_number(value: object) -> bool:
    return type(value) in (float, int) and 0 <= value <= 1 and isfinite(value)
