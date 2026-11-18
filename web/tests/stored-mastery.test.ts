import { describe, expect, it } from 'vitest'
import {
  createMemoryEvidenceStore,
  createMemoryMasteryStore,
  createMasteryRecalculator,
  estimateCourse,
  learningParameters,
  readStoredMastery,
  saveMasteryFromEvidence,
  storedCourseEstimate,
  type MasteryStore,
  type StoredMastery,
  type StudiedCourse,
} from '../server/student-model'

// Stored mastery (ADR 0008): the number is derived from evidence, kept per student
// and module, and read back from the store instead of recomputed on every request.
const course: StudiedCourse = {
  masteryThreshold: 0.9,
  modules: [
    { id: 'a', available: true, exerciseIds: ['a1'], questionIds: ['a_q1'] },
    { id: 'b', available: true, exerciseIds: ['b1'], questionIds: [] },
  ],
}

const passed = { studentId: 'an', moduleId: 'a', exerciseId: 'a1', testsPassed: 1, testsTotal: 1 }
const failed = { studentId: 'binh', moduleId: 'a', exerciseId: 'a1', testsPassed: 0, testsTotal: 1 }

function stored(moduleId: string, mastery: number, passedExercise: boolean, everMastered: boolean): StoredMastery {
  return { moduleId, mastery, passedExercise, everMastered }
}

describe('stored mastery', () => {
  it('saves one row for every module of the course', async () => {
    const evidence = createMemoryEvidenceStore()
    await evidence.append(passed)
    const mastery = createMemoryMasteryStore()

    const rows = await saveMasteryFromEvidence(course, await evidence.forStudent('an'), 'an', mastery)

    expect(rows.map(row => row.moduleId)).toEqual(['a', 'b'])
    expect(await mastery.forStudent('an')).toEqual(rows)
  })

  it('reads the stored picture as the estimate the ledger gives', async () => {
    const evidence = createMemoryEvidenceStore()
    await evidence.append(passed)
    const mastery = createMemoryMasteryStore()
    const rows = await saveMasteryFromEvidence(course, await evidence.forStudent('an'), 'an', mastery)

    expect(storedCourseEstimate(course, rows)).toEqual(
      estimateCourse(course, await evidence.forStudent('an')),
    )
  })

  it('shows the stored number rather than one recomputed from the ledger', async () => {
    const evidence = createMemoryEvidenceStore()
    await evidence.append(passed)
    const mastery = createMemoryMasteryStore()
    await mastery.save('an', [stored('a', 0.42, true, true), stored('b', 0.31, false, false)])

    const rows = await readStoredMastery(course, await evidence.forStudent('an'), 'an', mastery)

    expect(rows.find(item => item.moduleId === 'a')!.mastery).toBe(0.42)
    expect(storedCourseEstimate(course, rows).masteries).toEqual([
      { moduleId: 'a', mastery: 0.42 },
      { moduleId: 'b', mastery: 0.31 },
    ])
  })

  it('rebuilds and saves the whole picture from evidence when a module has no row', async () => {
    const evidence = createMemoryEvidenceStore()
    await evidence.append(passed)
    const mastery = createMemoryMasteryStore()
    await mastery.save('an', [stored('a', 0.95, true, true)])

    const rows = await readStoredMastery(course, await evidence.forStudent('an'), 'an', mastery)

    expect(rows.map(item => item.moduleId)).toEqual(['a', 'b'])
    expect(rows.find(item => item.moduleId === 'b')!.mastery).toBe(learningParameters.prior)
    expect(await mastery.forStudent('an')).toEqual(rows)
  })

  it('leaves out stored rows for a module the course no longer has', () => {
    const rows = [stored('a', 0.95, true, true), stored('gone', 0.6, true, true), stored('b', 0.2, false, false)]

    expect(storedCourseEstimate(course, rows).masteries).toEqual([
      { moduleId: 'a', mastery: 0.95 },
      { moduleId: 'b', mastery: 0.2 },
    ])
    expect(storedCourseEstimate(course, rows).passedExerciseModuleIds).toEqual(['a'])
  })

  it('opens a recorded unlock again but never closes one', () => {
    const rows = [stored('a', 0.2, true, false), stored('b', learningParameters.prior, false, false)]

    expect(storedCourseEstimate(course, rows, ['b']).unlockedModuleIds).toEqual(['a', 'b'])
    expect(storedCourseEstimate(course, rows).unlockedModuleIds).toEqual(['a'])
  })

  it('recomputes stored mastery for every enrolled student when the course changes', async () => {
    const evidence = createMemoryEvidenceStore()
    await evidence.append(passed)
    await evidence.append(failed)
    const mastery = createMemoryMasteryStore()
    const recalculate = createMasteryRecalculator({
      course: async () => course,
      enrolledStudentIds: async () => ['an', 'binh'],
      evidence: () => evidence,
      mastery: () => mastery,
    })

    await recalculate.forCourse('intro_python')

    const an = await mastery.forStudent('an')
    const binh = await mastery.forStudent('binh')
    expect(an.map(item => item.moduleId)).toEqual(['a', 'b'])
    expect(an.find(item => item.moduleId === 'a')!.passedExercise).toBe(true)
    expect(binh.find(item => item.moduleId === 'a')!.passedExercise).toBe(false)
    expect(an.find(item => item.moduleId === 'a')!.mastery)
      .toBeGreaterThan(binh.find(item => item.moduleId === 'a')!.mastery)
  })

  it('writes only the rows of the course it is asked to recompute', async () => {
    const evidence = createMemoryEvidenceStore()
    await evidence.append(passed)
    const byCourse = new Map<string, MasteryStore>()
    const storeFor = (courseId: string) => {
      if (!byCourse.has(courseId)) byCourse.set(courseId, createMemoryMasteryStore())
      return byCourse.get(courseId)!
    }
    const recalculate = createMasteryRecalculator({
      course: async () => course,
      enrolledStudentIds: async () => ['an'],
      evidence: () => evidence,
      mastery: storeFor,
    })

    await recalculate.forCourse('data_science')

    expect((await storeFor('data_science').forStudent('an')).map(item => item.moduleId)).toEqual(['a', 'b'])
    expect(await storeFor('intro_python').forStudent('an')).toEqual([])
  })
})
