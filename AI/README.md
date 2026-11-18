# Offline self-harm content experiment

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
