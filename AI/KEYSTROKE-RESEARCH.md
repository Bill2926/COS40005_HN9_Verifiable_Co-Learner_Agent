# Keystroke activity and editor use

Counts and timing summaries over short windows can indicate recent keyboard activity in a particular editor. A quiet window can include reading, planning, or looking up documentation. In a study of two introductory programming courses, Shrestha et al. found that even similar-length pauses could have several plausible explanations. Hart et al. used keystroke gaps to estimate aggregate time on task probabilistically and identified work before the first keystroke as a coverage gap. [Shrestha et al., *Pausing While Programming*](https://juholeinonen.com/assets/pdf/shrestha2022pausing.pdf), [Hart et al., *Time-on-task estimation*](https://pmc.ncbi.nlm.nih.gov/articles/PMC12445496/)

Keyboard activity and changes to a document are separate observations. Cursor navigation can add keyboard events without changing text, while paste and input-method composition can change text without a sequence of keypresses corresponding to the inserted characters. Completion, correctness, and authorship each require separate evidence. The Carnegie Mellon benchmark illustrates the difference in task design. Its 51 participants repeatedly typed a fixed password for an authentication experiment, so those timing records supply no editor-activity labels. [W3C Input Events Level 2 working draft](https://www.w3.org/TR/input-events-2/#interface-InputEvent-Attributes), [Killourhy and Maxion, CMU benchmark](https://www.cs.cmu.edu/~keystroke/)

The offline prototype uses synthetic learner profiles and generated counts of edits, corrections, and pastes in five-second bins. The generator labels windows by scenario, including periods of exercise editing, reading or review, idleness, and paste with few edits. All inputs are simulated. This scope avoids the exposure of student records, key values, precise timing traces, and editor or clipboard contents. Edwards et al. describe the difficulty of deidentifying real programming logs, and the CMU benchmark shows how fine-grained typing rhythms can serve as a biometric. [Edwards et al., *Two Public CS1 Keystroke Datasets*](https://jedm.educationaldatamining.org/index.php/JEDM/article/view/581), [Killourhy and Maxion, CMU benchmark](https://www.cs.cmu.edu/~keystroke/)

The prototype holds out entire synthetic learner profiles. Its evaluation measures how well the classifier recovers simulated labels under the generator’s assumptions. Exercise editing and unrelated typing can produce identical count traces, so identical traces yield the same classification regardless of context. Transfer to real editors would require a separate evaluation with independently labeled activity windows and held-out learners. Device, editing task, and input method can change the observed signals. [scikit-learn `GroupShuffleSplit`](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GroupShuffleSplit.html), [Belman et al., cross-device typing study](https://arxiv.org/abs/1912.02736), [Shrestha et al., *Pausing While Programming*](https://juholeinonen.com/assets/pdf/shrestha2022pausing.pdf), [W3C input-method composition events](https://www.w3.org/TR/input-events-2/#input-event-order-during-composition)

## Results on simulated profiles

Logistic regression uses five features per two-minute window. The split trains on 96 profiles and holds out 24, for 720 holdout windows with 288 labeled editing. The classifier uses a fixed threshold of 0.5. The comparison rule flags a window when at least three five-second bins have edits.

| Holdout metric | Logistic regression | Three-bin rule |
| --- | ---: | ---: |
| Precision | 85.5% | 69.4% |
| Recall | 77.8% | 86.5% |
| F1 | 0.815 | 0.770 |
| Balanced accuracy | 84.5% | 80.5% |
| True positives / false positives | 224 / 38 | 249 / 110 |
| True negatives / false negatives | 394 / 64 | 322 / 39 |

The classifier flagged 142 of 144 sustained-editing windows and 82 of 144 brief-editing windows. The matched examples gave the same score to exercise editing and unrelated typing, and the same score to planning away from the editor and being away from the desk. In this project, a submitted attempt and its evaluated result are recorded separately as Submission and Evidence. [Project glossary](../CONTEXT.md), [executed notebook](keystroke-activity.ipynb)

## Reproduce the run

From `AI/`, use Python 3.13 in an activated virtual environment.

```sh
python -m pip install -r requirements.txt
python -m nbconvert --to notebook --execute --inplace keystroke-activity.ipynb
```

The final cell exports [the numeric NumPy model](keystroke-activity-model.npz) and verifies all 720 holdout scores after reloading it.
