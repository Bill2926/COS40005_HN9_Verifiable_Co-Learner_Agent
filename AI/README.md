# Local ML demo and research

## Run the English prompt demo

From the repository root, use Python 3.13 in an activated virtual environment:

```sh
python -m pip install -r AI/requirements.txt
python AI/serve-models.py
```

Open [the local demo](http://127.0.0.1:8765). Enter an English prompt and choose **Classify prompt**. The result shows the historical self-harm content label, model score, threshold and model version. The model details show where the evaluation came from. The score describes the submitted text under the historical label. It has no calibration for student traffic.

The process loads the committed numeric export using the task and SHA-256 in the manifest. It starts from CPU parameters already trained offline. Serving requires no training, dataset download, model provider or application credentials. Requests remain on loopback. The service neither logs submitted text nor stores inputs. If the port is in use, run `python AI/serve-models.py --port 8766` and open the printed address.

### API

Send `POST /api/classify/prompt` with `Content-Type: application/json` and a JSON object:

```json
{"prompt":"Why does my Python loop skip an item?","language":"en"}
```

The service uses `language` as the caller's declaration. It accepts up to 4,000 characters per prompt and 64 KiB per request. A successful response contains the task, label, score, threshold, model and feature versions, experimental status and input source. `GET /api/models` returns metadata and model availability.

| Situation | Response |
|---|---|
| Invalid JSON or unexpected request fields | 400 with an error code and message |
| Missing content length or body over 64 KiB | 411 or 413 |
| Non-JSON content type | 415 |
| Blank or overlong prompt, or a language other than English | 422 |
| Missing, changed or incompatible model export | 503 with `model_unavailable` |

### Verify the demo

Run the HTTP tests from the repository root. For browser checks, install the web dependencies first, then run Playwright from `web/`.

```sh
python -m unittest discover -s AI/tests
cd web
pnpm exec playwright install chromium
pnpm exec playwright test --config playwright.ml.config.ts
```

The browser suite starts its own local inference process on port 8765. Stop a running demo on that port before running the suite.

## Offline self-harm content experiment

This research experiment scores English prompts for the historical OpenAI moderation label `SH`. It reads one prompt at a time and uses a CPU model. The [research note](RESEARCH.md) explains the label, data source and limits.

The companion [editor activity experiment](KEYSTROKE-RESEARCH.md) includes its own executed notebook and model export.

The [real CS1 log follow-up](CS1-SUBMISSION-RESEARCH.md) evaluates a separate model that forecasts an exercise's first recorded submission.

## Results

The benchmark has 1,444 unique prompts with a known label. The fixed split holds out 289 prompts, including 10 positives. Five-fold development predictions selected the threshold of 0.413605 before the holdout was scored.

| Holdout metric | Result |
| --- | ---: |
| Average precision | 0.659 |
| Average precision for a constant score | 0.035 |
| Precision | 53.3% |
| Recall | 80.0% |
| F1 | 0.640 |
| True positives / false positives | 8 / 7 |
| True negatives / false negatives | 272 / 2 |

In the independent synthetic classroom check, the model flagged 3 of 5 first-person signals, 0 of 5 ordinary course prompts, and 0 of 5 prompts that mention the topic about someone else or in an academic setting. These small groups illustrate behavior on specific phrasings. Scores are uncalibrated for student traffic, and the experiment evaluates English only. Keep the artifact for offline research.

## Reproduce or try the export

From this directory, use Python 3.13 in an activated virtual environment and run:

```sh
python -m pip install -r requirements.txt
python -m nbconvert --to notebook --execute --inplace self-harm-prompts.ipynb
python prompt_model.py "Why is my Python loop skipping items?"
```

Re-running the [notebook](self-harm-prompts.ipynb) downloads the pinned benchmark into memory, verifies its checksum, and updates the notebook outputs and [model export](self-harm-text-model.npz). The export stores numeric parameters in a compressed NumPy archive. The final notebook cell reloads the archive and verifies that it reproduces all 289 holdout scores.
