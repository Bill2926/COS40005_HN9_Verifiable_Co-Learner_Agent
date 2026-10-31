import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import type { FromWorker, ToWorker } from '../../app/python/protocol'
import { createPythonRunner as createRunner, type WorkerPort } from '../../app/python/runner'

export function createPythonRunner() {
  return createRunner(spawnNodeWorker)
}

function spawnNodeWorker(): WorkerPort {
  const worker = new Worker(
    fileURLToPath(new URL('./node-worker.mjs', import.meta.url)),
    { execArgv: [] },
  )

  return {
    post(message: ToWorker) {
      worker.postMessage(message)
    },
    onMessage(handler) {
      worker.on('message', (message: FromWorker) => handler(message))
    },
    onError(handler) {
      worker.on('error', error => handler(error instanceof Error ? error : new Error(String(error))))
    },
    terminate() {
      void worker.terminate()
    },
  }
}
