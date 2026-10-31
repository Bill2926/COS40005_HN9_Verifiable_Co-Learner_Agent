import { loadPyodide, version } from 'pyodide'
import { servePyodide } from './pyodide-session.mjs'

servePyodide({
  post: message => postMessage(message),
  listen: (handler) => {
    self.onmessage = event => handler(event.data)
  },
}, () => loadPyodide({
  indexURL: `https://cdn.jsdelivr.net/pyodide/v${version}/full/`,
}))
