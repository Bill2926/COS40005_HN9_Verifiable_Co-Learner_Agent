import { parentPort } from 'node:worker_threads'
import { loadPyodide } from 'pyodide'
import { servePyodide } from '../../app/python/pyodide-session.mjs'

if (!parentPort) {
  throw new Error('The Python runner worker needs a parent port.')
}

const port = parentPort

servePyodide({
  post: message => port.postMessage(message),
  listen: handler => port.on('message', handler),
}, () => loadPyodide())
