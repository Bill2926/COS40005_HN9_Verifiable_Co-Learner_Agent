"""Train and score the offline self-harm content baseline."""

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.special import expit
from sklearn.feature_extraction.text import HashingVectorizer, TfidfTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import normalize


SEED = 42
N_FEATURES = 2**16
MODEL_FORMAT = 1
MODEL_PATH = Path(__file__).resolve().parent / "self-harm-text-model.npz"


def vectorizer() -> HashingVectorizer:
    return HashingVectorizer(
        analyzer="char_wb",
        ngram_range=(3, 5),
        strip_accents="unicode",
        n_features=N_FEATURES,
        alternate_sign=False,
        norm=None,
    )


def build_model() -> Pipeline:
    return Pipeline([
        ("hash", vectorizer()),
        ("tfidf", TfidfTransformer()),
        ("classifier", LogisticRegression(
            solver="liblinear",
            class_weight="balanced",
            random_state=SEED,
        )),
    ])


def export_model(pipeline: Pipeline, threshold: float, path: Path = MODEL_PATH) -> None:
    classifier = pipeline.named_steps["classifier"]
    if not np.array_equal(classifier.classes_, [0, 1]):
        raise ValueError("Expected a fitted binary classifier with classes 0 and 1.")
    np.savez_compressed(
        path,
        format_version=MODEL_FORMAT,
        idf=pipeline.named_steps["tfidf"].idf_,
        coefficients=classifier.coef_[0],
        intercept=classifier.intercept_[0],
        threshold=threshold,
    )


def score_prompts(
    prompts: list[str], path: Path = MODEL_PATH
) -> tuple[np.ndarray, float]:
    with np.load(path, allow_pickle=False) as archive:
        if archive["format_version"].item() != MODEL_FORMAT:
            raise ValueError("Unsupported model artifact format.")
        idf = archive["idf"]
        coefficients = archive["coefficients"]
        intercept = archive["intercept"].item()
        threshold = archive["threshold"].item()
    if idf.shape != (N_FEATURES,) or coefficients.shape != (N_FEATURES,):
        raise ValueError("Model features do not match the vectorizer.")

    counts = vectorizer().transform(prompts)
    weighted = normalize(counts.multiply(idf), norm="l2")
    return expit(weighted @ coefficients + intercept), threshold


def main() -> None:
    parser = argparse.ArgumentParser(description="Score a synthetic prompt locally.")
    parser.add_argument("prompt")
    args = parser.parse_args()
    scores, threshold = score_prompts([args.prompt])
    score = float(scores[0])
    print(json.dumps({"score": score, "threshold": threshold, "flagged": score >= threshold}))


if __name__ == "__main__":
    main()
