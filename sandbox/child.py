import builtins
import io
import json
import os
import signal
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import guard


class TooMuchOutput(Exception):
    pass


class Capped(io.TextIOBase):
    def __init__(self, limit):
        self.limit = limit
        self.parts = []
        self.used = 0

    def write(self, text):
        if not isinstance(text, str):
            text = str(text)
        self.used += len(text.encode("utf-8"))
        if self.used > self.limit:
            raise TooMuchOutput()
        self.parts.append(text)
        return len(text)

    def flush(self):
        return None


def install_hook():
    real_import = builtins.__import__
    # Names of approved libraries whose import is in progress. A private
    # accelerator such as _math_integer is allowed only while one of them loads.
    loading = []

    def allowed(name):
        top = (name or "").split(".", 1)[0]
        if top in guard.APPROVED:
            return True
        return top.startswith("_") and bool(loading)

    def guarded(name, globals=None, locals=None, fromlist=(), level=0):
        if level:
            raise ImportError(guard.refusal("."))
        top = (name or "").split(".", 1)[0]
        if not allowed(name):
            raise ImportError(guard.refusal(top))
        if top in guard.APPROVED:
            loading.append(top)
        try:
            return real_import(name, globals, locals, fromlist, level)
        finally:
            if top in guard.APPROVED and loading:
                loading.pop()

    class Finder:
        def find_spec(self, fullname, path, target=None):
            if allowed(fullname):
                return None
            raise ImportError(guard.refusal(fullname.split(".", 1)[0]))

    sys.meta_path.insert(0, Finder())
    return guarded


def format_error(exc):
    text = str(exc)
    if text.startswith("The library "):
        return text
    if isinstance(exc, SyntaxError):
        return "SyntaxError: " + (exc.msg or "invalid syntax")
    return type(exc).__name__ + ": " + text


def emit(payload):
    sys.__stdout__.write(json.dumps(payload))
    sys.__stdout__.flush()


def worker():
    # Student code runs here. It does not learn the expected values, and a
    # document it writes on this process's stdout is not a pass: the supervisor
    # decides that by comparing each actual with the expected value it kept.
    payload = json.load(sys.stdin)
    code = payload["code"]
    tests = payload["tests"]
    namespace = {"__name__": "__main__"}
    if not payload.get("confineOnly"):
        guarded = install_hook()
        namespace["__builtins__"] = {**vars(builtins), "__import__": guarded}
    stdout = Capped(guard.OUTPUT_LIMIT)
    stderr = Capped(guard.OUTPUT_LIMIT)
    previous_out, previous_err = sys.stdout, sys.stderr
    sys.stdout = stdout
    sys.stderr = stderr
    try:
        compiled = compile(code, "<student>", "exec")
        exec(compiled, namespace)
        actuals = []
        for test in tests:
            try:
                actual = str(eval(test["expression"], namespace))
            except TooMuchOutput:
                raise
            except MemoryError:
                raise
            except Exception as exc:
                actual = format_error(exc)
                if actual.startswith("The library "):
                    emit({"outcome": "refused", "message": actual})
                    return
            actuals.append({"name": test["name"], "actual": actual})
        emit({"actuals": actuals})
    except TooMuchOutput:
        emit({"outcome": "refused", "message": guard.PRINTED_TOO_MUCH})
    except MemoryError:
        emit({"outcome": "refused", "message": guard.USED_TOO_MUCH_MEMORY})
    except Exception as exc:
        actual = format_error(exc)
        if actual.startswith("The library "):
            emit({"outcome": "refused", "message": actual})
            return
        emit({"actuals": [{"name": test["name"], "actual": actual} for test in tests]})
    finally:
        sys.stdout = previous_out
        sys.stderr = previous_err


def could_not_check():
    return {"outcome": "refused", "message": "This submission could not be checked."}


def score(tests, out, returncode):
    if returncode not in (0, None):
        if returncode is not None and returncode < 0 and -returncode in (signal.SIGXCPU, signal.SIGALRM):
            return {"outcome": "refused", "message": guard.TOOK_TOO_LONG}
        if returncode is not None and returncode < 0:
            return {"outcome": "refused", "message": guard.USED_TOO_MUCH_MEMORY}
        return could_not_check()
    try:
        data = json.loads(out.decode("utf-8", errors="replace").strip())
    except (json.JSONDecodeError, UnicodeError):
        return could_not_check()
    if isinstance(data, dict) and data.get("outcome") == "refused" and isinstance(data.get("message"), str):
        return {"outcome": "refused", "message": data["message"]}
    actuals = data.get("actuals") if isinstance(data, dict) else None
    if not isinstance(actuals, list):
        return could_not_check()
    by_name = {}
    for item in actuals:
        if not isinstance(item, dict) or "passed" in item or "expected" in item:
            return could_not_check()
        name = item.get("name")
        actual = item.get("actual")
        if not isinstance(name, str) or not isinstance(actual, str):
            return could_not_check()
        by_name[name] = actual
    results = []
    for test in tests:
        if test["name"] not in by_name:
            return could_not_check()
        actual = by_name[test["name"]]
        results.append({
            "name": test["name"],
            "passed": actual == test["expected"],
            "expected": test["expected"],
            "actual": actual,
        })
    return {"outcome": "checked", "results": results}


def supervise(payload):
    tests = payload["tests"]
    worker_body = {
        "code": payload["code"],
        "tests": [{"name": test["name"], "expression": test["expression"]} for test in tests],
        "confineOnly": bool(payload.get("confineOnly")),
    }
    env = dict(os.environ)
    env["SANDBOX_WORKER"] = "1"
    proc = subprocess.Popen(
        [sys.executable, "-I", os.path.abspath(__file__)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        close_fds=True,
    )
    try:
        out, _err = proc.communicate(json.dumps(worker_body).encode(), timeout=guard.SECONDS)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
        return {"outcome": "refused", "message": guard.TOOK_TOO_LONG}
    return score(tests, out, proc.returncode)


def main():
    if os.environ.get("SANDBOX_WORKER") == "1":
        worker()
        return
    payload = json.load(sys.stdin)
    emit(supervise(payload))


if __name__ == "__main__":
    try:
        main()
    except MemoryError:
        emit({"outcome": "refused", "message": guard.USED_TOO_MUCH_MEMORY})
