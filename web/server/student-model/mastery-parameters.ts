import type { MasteryParameters } from './estimate'

// The four Bayesian Knowledge Tracing parameters and the mastery threshold are the same for every
// module, so they are written here and not in the estimator or in the course content.
export const masteryParameters: MasteryParameters = {
  prior: 0.1,
  learning: 0.15,
  byKind: {
    submission: { slip: 0.1, guess: 0.2 },
    quiz_answer: { slip: 0.1, guess: 0.25 },
  },
  threshold: 0.9,
}

export const masteryThreshold = masteryParameters.threshold
