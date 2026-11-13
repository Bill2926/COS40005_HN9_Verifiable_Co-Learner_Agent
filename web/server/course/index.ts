// The course component's interface: the course as data (its modules, scope keywords and the
// roadmap a student sees) and the study content of the modules that have any. Code outside this
// folder imports only from here.
export {
  courseModules,
  courseScope,
  courseTitle,
  presentedRoadmap,
  redirectText,
  roadmapForStanding,
} from './course'
export { canonicalModuleId, studyModule, studyModules } from './study-module'
export type { Exercise, StudyModule } from './study-module'
