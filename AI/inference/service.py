from dataclasses import dataclass
from math import isfinite
from pathlib import Path

from prompt_model import PromptModel

from .artifacts import load_prompt_artifact


MAX_PROMPT_LENGTH = 4_000


@dataclass(frozen=True)
class ApiError(Exception):
    status: int
    code: str
    message: str


@dataclass(frozen=True)
class InferenceService:
    metadata: dict
    prompt_model: PromptModel | None

    @classmethod
    def load(cls, model_dir: Path) -> "InferenceService":
        return cls(*load_prompt_artifact(model_dir))

    def models(self) -> dict:
        return {"models": [{**self.metadata, "available": self.prompt_model is not None}]}

    def classify_prompt(self, data: dict) -> dict:
        prompt = data.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > MAX_PROMPT_LENGTH:
            raise ApiError(422, "invalid_prompt", f"Enter a prompt of 1 to {MAX_PROMPT_LENGTH:,} characters.")
        if data.get("language") != "en":
            raise ApiError(422, "unsupported_language", "Choose English for this model.")
        if set(data) != {"prompt", "language"}:
            raise ApiError(400, "invalid_request", "Send only prompt and language.")
        if self.prompt_model is None:
            raise ApiError(503, "model_unavailable", "The prompt model is unavailable. Check the model export and restart.")

        score = float(self.prompt_model.score([prompt])[0])
        if not isfinite(score) or not 0 <= score <= 1:
            raise ApiError(500, "inference_failed", "The model could not score this prompt.")
        threshold = self.prompt_model.threshold
        labels = "positiveLabel" if score >= threshold else "negativeLabel"
        return {
            "status": "scored",
            "task": self.metadata["task"],
            "modelVersion": self.metadata["modelVersion"],
            "featureVersion": self.metadata["featureVersion"],
            "score": score,
            "threshold": threshold,
            "label": self.metadata[labels],
            "evaluationStatus": self.metadata["evaluationStatus"],
            "source": "manual",
        }
