const studentRunner = `
import json
import sys
import traceback
from io import StringIO

def __run_student__(code):
    stdout_buffer = StringIO()
    stderr_buffer = StringIO()
    previous_stdout = sys.stdout
    previous_stderr = sys.stderr
    sys.stdout = stdout_buffer
    sys.stderr = stderr_buffer
    error = None
    try:
        compiled = compile(code, "<student>", "exec")
        exec(compiled, {"__name__": "__main__"})
    except SyntaxError as exc:
        error = {
            "message": "SyntaxError: " + (exc.msg or "invalid syntax"),
            "line": exc.lineno or 1,
        }
    except Exception as exc:
        line = 1
        for frame in traceback.extract_tb(exc.__traceback__):
            if frame.filename == "<student>" and frame.lineno:
                line = frame.lineno
        error = {
            "message": type(exc).__name__ + ": " + str(exc),
            "line": line,
        }
    finally:
        sys.stdout = previous_stdout
        sys.stderr = previous_stderr
    return json.dumps({
        "stdout": stdout_buffer.getvalue(),
        "stderr": stderr_buffer.getvalue(),
        "error": error,
    })
`

function installStudentRunner(pyodide) {
  pyodide.runPython(studentRunner, { dedent: false })
}

function runStudentCode(pyodide, code) {
  const raw = pyodide.runPython(`__run_student__(${JSON.stringify(code)})`, { dedent: false })
  const text = typeof raw === 'string' ? raw : String(raw)
  if (raw && typeof raw.destroy === 'function') raw.destroy()
  return JSON.parse(text)
}

export async function servePyodide(host, load) {
  let pyodide = null

  host.listen((message) => {
    if (!pyodide || message?.type !== 'run') return
    host.post({ type: 'started', id: message.id })
    try {
      const result = runStudentCode(pyodide, message.code)
      host.post({ type: 'result', id: message.id, result })
    }
    catch (error) {
      host.post({
        type: 'failed',
        message: error instanceof Error ? error.message : 'Python failed.',
      })
    }
  })

  try {
    pyodide = await load()
    installStudentRunner(pyodide)
  }
  catch (error) {
    host.post({
      type: 'failed',
      message: error instanceof Error ? error.message : 'Python failed to start.',
    })
    return
  }

  host.post({ type: 'ready' })
}
