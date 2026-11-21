from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
from zipfile import BadZipFile

from prompt_model import MODEL_FORMAT, PromptModel, load_prompt_model


AI_ROOT = Path(__file__).resolve().parents[1]


def load_prompt_artifact(model_dir: Path) -> tuple[dict, PromptModel | None]:
    metadata = json.loads((AI_ROOT / "model-manifest.json").read_text(encoding="utf-8"))
    try:
        data = (model_dir / metadata["artifact"]).read_bytes()
        if sha256(data).hexdigest() != metadata["sha256"]:
            return metadata, None
        if metadata["formatVersion"] != MODEL_FORMAT or metadata["task"] != "prompt_content":
            return metadata, None
        model = load_prompt_model(BytesIO(data))
        if model.threshold != metadata["threshold"]:
            return metadata, None
    except (OSError, ValueError, KeyError, EOFError, BadZipFile):
        return metadata, None
    return metadata, model
