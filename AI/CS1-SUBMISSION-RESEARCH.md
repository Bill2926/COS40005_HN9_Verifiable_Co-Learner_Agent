# Forecasting a submission from real CS1 editor logs

This follow-up uses real IDE events to predict the first recorded submission for an exercise in the next ten minutes. It keeps the earlier [synthetic editor-activity experiment](KEYSTROKE-RESEARCH.md) as a separate experiment with its own target.

## Dataset

Juho Leinonen and Arto Hellas published the *IDE Action Log Dataset from a CS1 MOOC* in 2022 under CC BY 4.0. The IDE logs include typed insertions, removals, pastes, focus changes, runs, and submissions to automated assessment. The dataset describes opt-in logging and excludes the contents of the code and the identities of the keys pressed. A submission is an attempt sent for assessment. [Zenodo v1 release](https://doi.org/10.5281/zenodo.6903968) · [Dataset README](https://zenodo.org/records/6903968/files/README.txt?download=1) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

The loader uses nine fixed 16 MiB ranges spread across the 1.36 GB CSV. It discards learner blocks touched by range boundaries and checks for duplicate learner blocks in the retained sample. The sample contains **2,375,731 recorded events from 38 learners**. Sampling whole interior blocks can favor learners with shorter logs. The sample checksum is pinned, and the loader holds the raw CSV sample in the OS temporary directory. Only aggregate results and numeric parameters are published.

## Evaluation

For each learner, course part and exercise, two minutes of preceding editor changes give five numeric features. The label checks whether that same exercise receives its first recorded submission during the next ten minutes. We restrict evaluation to windows with an editor change and a full ten-minute horizon before the part deadline and the last observed activity for that learner and part. Interruptions in opt-in logging can still hide activity. [Dataset README](https://zenodo.org/records/6903968/files/README.txt?download=1)

Training and threshold selection use 30 learners. The holdout contains **4,757 windows from 8 separate learners**, with 2,005 positive windows. The threshold maximizes F1 on grouped out-of-fold training predictions.

| Held-out measure | Result |
| --- | ---: |
| Average precision · Logistic Regression | 0.4910 |
| Average precision · count of bins with edits | 0.5206 |
| Average precision · constant score | 0.4215 |
| Precision at the selected model threshold | 42.41% |
| Recall at the selected model threshold | 95.81% |
| Model F1 at the selected threshold | 0.5879 |
| F1 if every window is flagged | 0.5930 |
| Correctly flagged / falsely flagged | 1,921 / 2,609 |
| Correctly cleared / missed | 143 / 84 |

The simpler ranking by active edit bins performed better on this holdout. The classifier's high recall came with frequent false alarms. These results apply to sampled windows in one historical course. Submission outcomes such as correctness, authorship, and completion require their own evidence.

## Reproduce

Run from `AI/` with Python 3.13 in an activated virtual environment.

```sh
python -m pip install -r requirements.txt
python -m nbconvert --to notebook --execute --inplace cs1-submission-prediction.ipynb
```

The [executed notebook](cs1-submission-prediction.ipynb) contains the precision–recall plot and verifies that reloading the [numeric model export](cs1-submission-model.npz) reproduces all 4,757 holdout scores.
