import type { FromWorker, ToWorker } from './protocol'
import { createPythonRunner as createRunner, type WorkerPort } from './runner'

export function createPythonRunner() {
  return createRunner(spawnBrowserWorker)
}

function spawnBrowserWorker(): WorkerPort {
  const worker = new Worker(new URL('./browser-worker.mjs', import.meta.url), { type: 'module' })

  return {
    post(message: ToWorker) {
      worker.postMessage(message)
    },
    onMessage(handler) {
      worker.onmessage = (event: MessageEvent<FromWorker>) => handler(event.data)
    },
    onError(handler) {
      worker.onerror = (event) => {
        handler(new Error(event.message || 'Python failed to start.'))
      }
    },
    terminate() {
      worker.terminate()
    },
  }
}
