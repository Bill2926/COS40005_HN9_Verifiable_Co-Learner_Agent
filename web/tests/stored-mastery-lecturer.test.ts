import { describe, expect, it } from 'vitest'
import { courseFromSpec, defaultCourseId, pythonCourse, pythonCourseSpec, type CourseSpec } from '../server/course'
import { handleCourseSpec, handleLecturer } from '../server/lecturer/handle-lecturer'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import type { CourseStore } from '../server/storage/course-store'
import { createMemoryLecturerStore, type LecturerStore } from '../server/storage/lecturer-store'
import {
  createMemoryEvidenceStore,
  createMemoryMasteryStore,
  createMemoryUnlockStore,
  createMasteryRecalculator,
  type EvidenceStore,
  type MasteryRecalculator,
  type MasteryStore,
} from '../server/student-model'
import { handleTurn } from '../server/turn/handle-turn'

// A course changing is the other half of stored mastery (ADR 0008): every enrolled student's
// stored picture is recomputed then, not left until they next submit.
const lecturerEmail = 'lecturer@example.com'
const lecturerEmails = 'other@example.com, lecturer@example.com'
const an = '6f1b0c1e-1111-4111-8111-111111111111'
const binh = '6f1b0c1e-2222-4222-8222-222222222222'
const firstModule = 'getting_started'
const secondModule = 'variables'
const moduleIds = pythonCourse.modules.map(module => module.id)

function specAt(threshold: number): CourseSpec {
  return { ...structuredClone(pythonCourseSpec), masteryThreshold: threshold }
}

function lecturerStoreAt(threshold: number): LecturerStore {
  return createMemoryLecturerStore([{
    ownerEmail: lecturerEmail,
    id: defaultCourseId,
    title: 'Introduction to Programming with Python',
    enrolledCount: 2,
    masteryThreshold: threshold,
    history: [],
    students: [],
    spec: specAt(threshold),
  }])
}

// An exercise passed three times over, which the estimate puts at 0.9576: above 0.9 and
// below 0.99, so a threshold change moves the module off the mark without any new evidence.
async function enrolledEvidence(): Promise<EvidenceStore> {
  const evidence = createMemoryEvidenceStore()
  for (const exerciseId of ['say_hello', 'join_words', 'sign_the_program']) {
    await evidence.append({ studentId: an, moduleId: firstModule, exerciseId, testsPassed: 3, testsTotal: 3 })
  }
  await evidence.append({ studentId: binh, moduleId: firstModule, exerciseId: 'say_hello', testsPassed: 0, testsTotal: 3 })
  return evidence
}

function recalculateFor(courses: CourseStore, evidence: EvidenceStore, mastery: MasteryStore): MasteryRecalculator {
  return createMasteryRecalculator({
    course: (courseId) => courses.course(courseId),
    enrolledStudentIds: async () => [an, binh],
    evidence: () => evidence,
    mastery: () => mastery,
  })
}

// The course as it now stands, published threshold included: the same read the turn makes, so a
// recompute and the roadmap that shows it cannot disagree about what the mark is.
function publishedCourseStore(store: LecturerStore): CourseStore {
  return {
    async course(courseId) {
      return courseFromSpec((await store.exportSpec(lecturerEmail, courseId)) ?? specAt(0.9))
    },
  }
}

describe('stored mastery when the course changes', () => {
  it('recomputes every enrolled student when the lecturer publishes a course spec', async () => {
    const store = lecturerStoreAt(0.9)
    const evidence = await enrolledEvidence()
    const mastery = createMemoryMasteryStore()
    await handleCourseSpec({ email: lecturerEmail, lecturerEmails, store, action: 'save', json: JSON.stringify(specAt(0.99)) })

    await handleCourseSpec({
      email: lecturerEmail,
      lecturerEmails,
      store,
      action: 'publish',
      courseId: defaultCourseId,
      recalculate: recalculateFor(publishedCourseStore(store), evidence, mastery),
    })

    const anRows = await mastery.forStudent(an)
    expect(anRows.map(item => item.moduleId)).toEqual(moduleIds)
    expect(anRows.find(item => item.moduleId === firstModule)!.mastery).toBeCloseTo(0.9576, 3)
    expect(anRows.find(item => item.moduleId === firstModule)!.everMastered).toBe(false)
    const binhRows = await mastery.forStudent(binh)
    expect(binhRows.find(item => item.moduleId === firstModule)!.passedExercise).toBe(false)
    expect(binhRows.find(item => item.moduleId === firstModule)!.everMastered).toBe(false)
  })

  it('recomputes every enrolled student when the lecturer changes the mastery threshold', async () => {
    const store = lecturerStoreAt(0.9)
    const evidence = await enrolledEvidence()
    const mastery = createMemoryMasteryStore()
    const recalculate = recalculateFor(publishedCourseStore(store), evidence, mastery)

    await handleLecturer({
      email: lecturerEmail,
      lecturerEmails,
      store,
      change: { courseId: defaultCourseId, threshold: 0.9 },
      recalculate,
    })
    expect((await mastery.forStudent(an)).find(item => item.moduleId === firstModule)!.everMastered).toBe(true)

    await handleLecturer({
      email: lecturerEmail,
      lecturerEmails,
      store,
      change: { courseId: defaultCourseId, threshold: 0.99 },
      recalculate,
    })

    expect((await mastery.forStudent(an)).find(item => item.moduleId === firstModule)!.everMastered).toBe(false)
    expect((await mastery.forStudent(binh)).find(item => item.moduleId === firstModule)!.mastery).toBeLessThan(0.99)
  })

  it('keeps a recorded unlock open after a recompute takes the module off the threshold', async () => {
    const store = lecturerStoreAt(0.9)
    const evidence = await enrolledEvidence()
    const mastery = createMemoryMasteryStore()
    const unlocks = createMemoryUnlockStore()
    const conversations = createMemoryConversationStore({ [an]: 'An' })
    const courses = publishedCourseStore(store)
    const options = {
      evidence,
      unlocks,
      mastery,
      courses,
    }
    const open = () => handleTurn({ sessionStudentId: an, body: { event: 'open' } }, conversations, undefined, options)

    expect((await open()).courseRoadmap.find(module => module.id === firstModule)!.state).toBe('mastered')
    expect((await open()).courseRoadmap.find(module => module.id === secondModule)!.state).toBe('open')

    await handleLecturer({
      email: lecturerEmail,
      lecturerEmails,
      store,
      change: { courseId: defaultCourseId, threshold: 0.99 },
      recalculate: recalculateFor(courses, evidence, mastery),
    })

    const roadmap = (await open()).courseRoadmap
    expect(roadmap.find(module => module.id === firstModule)!.state).toBe('open')
    expect(roadmap.find(module => module.id === secondModule)!.state).toBe('open')
  })
})
