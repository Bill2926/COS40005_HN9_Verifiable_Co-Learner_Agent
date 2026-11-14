import { pythonCourse } from '../course'

// The public outline of the course for the About page: names and parts only,
// nothing about any student.
export default defineEventHandler(() => ({
  title: pythonCourse.title,
  modules: pythonCourse.modules.map(({ number, name, part, summary, available }) => ({ number, name, part, summary, available })),
}))
