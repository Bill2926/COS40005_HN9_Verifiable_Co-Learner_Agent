import { courseModules, courseTitle } from '../content/course'

// The public outline of the course for the About page: names and parts only,
// nothing about any student.
export default defineEventHandler(() => ({
  title: courseTitle,
  modules: courseModules.map(({ number, name, part, summary, available }) => ({ number, name, part, summary, available })),
}))
