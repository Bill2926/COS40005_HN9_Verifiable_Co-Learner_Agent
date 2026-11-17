import type { CoursePreview, CoursePreviewModule } from '../../shared/lecturer'
import type { CourseSpec } from '../course'

// The lecturer's view of a spec. Exercises can be run from the tests included
// here. Reference solutions stay out. Nothing is stored.
export function coursePreview(spec: CourseSpec, draft: boolean): CoursePreview {
  return {
    courseId: spec.courseId,
    title: spec.title,
    draft,
    modules: spec.modules.map((module): CoursePreviewModule => ({
      id: module.id,
      name: module.name,
      part: module.part,
      summary: module.summary,
      available: module.content !== undefined,
      materials: module.content ? module.content.materials.map(block => ({ ...block })) : [],
      quiz: module.content
        ? module.content.quiz.map(question => ({
            id: question.id,
            prompt: question.prompt,
            choices: question.choices,
            correctIndex: question.correctIndex,
            explanation: question.explanation,
            teacherOnly: true as const,
          }))
        : [],
      exercises: module.content
        ? module.content.exercises.map(exercise => ({
            id: exercise.id,
            title: exercise.title,
            statement: exercise.statement,
            starterCode: exercise.starterCode,
            tests: exercise.tests,
          }))
        : [],
      hintLadder: module.content
        ? { rungs: module.content.hintLadder, teacherOnly: true as const }
        : null,
      misconceptionResponses: module.content
        ? module.content.misconceptionResponses.map(response => ({ ...response, teacherOnly: true as const }))
        : [],
    })),
  }
}
