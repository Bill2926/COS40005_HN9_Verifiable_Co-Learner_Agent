import builtins
import io
import json
import os
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


def failed_tests(tests, actual):
    return [
        {"name": test["name"], "passed": False, "expected": test["expected"], "actual": actual}
        for test in tests
    ]


def main():
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
        results = []
        for test in tests:
            expected = test["expected"]
            try:
                actual = str(eval(test["expression"], namespace))
                passed = actual == expected
            except TooMuchOutput:
                raise
            except MemoryError:
                raise
            except Exception as exc:
                actual = format_error(exc)
                if actual.startswith("The library "):
                    emit({"outcome": "refused", "message": actual})
                    return
                passed = False
            results.append({
                "name": test["name"],
                "passed": passed,
                "expected": expected,
                "actual": actual,
            })
        emit({"outcome": "checked", "results": results})
    except TooMuchOutput:
        emit({"outcome": "refused", "message": guard.PRINTED_TOO_MUCH})
    except MemoryError:
        emit({"outcome": "refused", "message": guard.USED_TOO_MUCH_MEMORY})
    except Exception as exc:
        actual = format_error(exc)
        if actual.startswith("The library "):
            emit({"outcome": "refused", "message": actual})
            return
        emit({"outcome": "checked", "results": failed_tests(tests, actual)})
    finally:
        sys.stdout = previous_out
        sys.stderr = previous_err


if __name__ == "__main__":
    try:
        main()
    except MemoryError:
        emit({"outcome": "refused", "message": guard.USED_TOO_MUCH_MEMORY})
