const prefix = 'co-learner-draft:'

export interface DraftStore {
  read: (exerciseId: string) => string | null
  write: (exerciseId: string, code: string) => void
}

export function createDraftStore(storage: Pick<Storage, 'getItem' | 'setItem'>): DraftStore {
  return {
    read(exerciseId) {
      return storage.getItem(prefix + exerciseId)
    },
    write(exerciseId, code) {
      storage.setItem(prefix + exerciseId, code)
    },
  }
}

export function draftAfterSwitch(
  store: DraftStore,
  move: {
    leavingId: string
    leavingCode: string
    enteringId: string
    enteringStarter: string
  },
): string {
  if (move.leavingId !== move.enteringId) {
    store.write(move.leavingId, move.leavingCode)
  }
  return store.read(move.enteringId) ?? move.enteringStarter
}
