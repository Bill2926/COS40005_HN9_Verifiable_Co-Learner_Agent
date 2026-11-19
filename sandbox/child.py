import builtins
import io
import json
import os
import signal
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


def produce(payload):
    # Student code runs in the forked process. It is not given the expected
    # values. Whatever it writes is not a pass: the parent compares each actual.
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
                    return {"outcome": "refused", "message": actual}
            actuals.append({"name": test["name"], "actual": actual})
        return {"actuals": actuals}
    except TooMuchOutput:
        return {"outcome": "refused", "message": guard.PRINTED_TOO_MUCH}
    except MemoryError:
        return {"outcome": "refused", "message": guard.USED_TOO_MUCH_MEMORY}
    except Exception as exc:
        actual = format_error(exc)
        if actual.startswith("The library "):
            return {"outcome": "refused", "message": actual}
        return {"actuals": [{"name": test["name"], "actual": actual} for test in tests]}
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
    # Fork inside the jail. A second interpreter cannot be started there: its
    # path is the jail path, and spawning it is what made every image check fail.
    tests = payload["tests"]
    student = {
        "code": payload["code"],
        "tests": [{"name": test["name"], "expression": test["expression"]} for test in tests],
        "confineOnly": bool(payload.get("confineOnly")),
    }
    read_fd, write_fd = os.pipe()
    pid = os.fork()
    if pid == 0:
        try:
            os.close(read_fd)
            # fd 1 is the report back to the runner. Close it before student code.
            os.close(1)
            os.dup2(write_fd, 1)
            os.close(write_fd)
            os.write(1, json.dumps(produce(student)).encode())
            os._exit(0)
        except MemoryError:
            os._exit(2)
        except Exception as exc:
            try:
                os.write(1, json.dumps({
                    "outcome": "refused",
                    "message": f"This submission could not be checked. ({type(exc).__name__}: {exc})",
                }).encode())
            except Exception:
                pass
            os._exit(1)
    os.close(write_fd)
    chunks = []
    while True:
        chunk = os.read(read_fd, 65536)
        if not chunk:
            break
        chunks.append(chunk)
    os.close(read_fd)
    _, status = os.waitpid(pid, 0)
    return score(tests, b"".join(chunks), os.waitstatus_to_exitcode(status))


def main():
    payload = json.load(sys.stdin)
    emit(supervise(payload))


if __name__ == "__main__":
    try:
        main()
    except MemoryError:
        emit({"outcome": "refused", "message": guard.USED_TOO_MUCH_MEMORY})
