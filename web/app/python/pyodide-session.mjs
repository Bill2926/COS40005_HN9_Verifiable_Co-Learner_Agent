import { importGuardSource } from './approved-libraries.mjs'

const studentRunner = `
import json
import sys
import traceback
from io import StringIO

def __run_student__(code):
    refused = __disallowed__(code)
    if refused:
        line, name = refused
        return json.dumps({
            "stdout": "",
            "stderr": "",
            "error": {"message": __library_refusal__(name), "line": line},
        })
    stdout_buffer = StringIO()
    stderr_buffer = StringIO()
    previous_stdout = sys.stdout
    previous_stderr = sys.stderr
    sys.stdout = stdout_buffer
    sys.stderr = stderr_buffer
    error = None
    __begin_import_guard__()
    try:
        compiled = compile(code, "<student>", "exec")
        exec(compiled, {"__name__": "__main__", "__builtins__": __student_builtins__()})
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
        text = str(exc)
        error = {
            "message": text if text.startswith("The library ") else type(exc).__name__ + ": " + text,
            "line": line,
        }
    finally:
        __end_import_guard__()
        sys.stdout = previous_stdout
        sys.stderr = previous_stderr
    return json.dumps({
        "stdout": stdout_buffer.getvalue(),
        "stderr": stderr_buffer.getvalue(),
        "error": error,
    })
`

const studentChecks = `
import json

def __format_check_error__(exc):
    text = str(exc)
    if text.startswith("The library "):
        return text
    if isinstance(exc, SyntaxError):
        return "SyntaxError: " + (exc.msg or "invalid syntax")
    return type(exc).__name__ + ": " + text

def __check_student__(payload):
    data = json.loads(payload)
    code = data["code"]
    tests = data["tests"]
    refused = __disallowed__(code)
    if refused:
        _line, name = refused
        message = __library_refusal__(name)
        refused_results = []
        for test in tests:
            refused_results.append({
                "name": test["name"],
                "passed": False,
                "expected": test["expected"],
                "actual": message,
            })
        return json.dumps({"results": refused_results})
    results = []
    namespace = {"__name__": "__main__", "__builtins__": __student_builtins__()}
    __begin_import_guard__()
    try:
        try:
            compiled = compile(code, "<student>", "exec")
            exec(compiled, namespace)
        except Exception as exc:
            actual = __format_check_error__(exc)
            for test in tests:
                results.append({
                    "name": test["name"],
                    "passed": False,
                    "expected": test["expected"],
                    "actual": actual,
                })
            return json.dumps({"results": results})

        for test in tests:
            expected = test["expected"]
            try:
                value = eval(test["expression"], namespace)
                actual = str(value)
                passed = actual == expected
            except Exception as exc:
                actual = __format_check_error__(exc)
                passed = False
            results.append({
                "name": test["name"],
                "passed": passed,
                "expected": expected,
                "actual": actual,
            })
        return json.dumps({"results": results})
    finally:
        __end_import_guard__()
`

function installStudentRunner(pyodide) {
  pyodide.runPython(importGuardSource, { dedent: false })
  pyodide.runPython(studentRunner, { dedent: false })
  pyodide.runPython(studentChecks, { dedent: false })
}

function checkStudentCode(pyodide, code, tests) {
  const payload = JSON.stringify({ code, tests })
  const raw = pyodide.runPython(`__check_student__(${JSON.stringify(payload)})`, { dedent: false })
  const text = typeof raw === 'string' ? raw : String(raw)
  if (raw && typeof raw.destroy === 'function') raw.destroy()
  return JSON.parse(text)
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
    if (!pyodide) return
    if (message?.type === 'run') {
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
      return
    }
    if (message?.type !== 'check') return
    host.post({ type: 'started', id: message.id })
    try {
      const result = checkStudentCode(pyodide, message.code, message.tests)
      host.post({ type: 'checked', id: message.id, result })
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
