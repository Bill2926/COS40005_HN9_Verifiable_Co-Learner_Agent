import type { MasteryParameters } from './estimate'

// The four Bayesian Knowledge Tracing parameters are the same for every module and every course,
// so they are written here and not in the estimator or in the course content. The mastery
// threshold belongs to the course: each course spec sets its own.
export const learningParameters: Omit<MasteryParameters, 'threshold'> = {
  prior: 0.1,
  learning: 0.15,
  byKind: {
    submission: { slip: 0.1, guess: 0.2 },
    quiz_answer: { slip: 0.1, guess: 0.25 },
  },
}

export function masteryParametersFor(threshold: number): MasteryParameters {
  return { ...learningParameters, threshold }
}
