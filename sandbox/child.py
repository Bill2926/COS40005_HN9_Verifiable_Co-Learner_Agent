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


def apply_process_cap():
    # Docker caps processes on the container. Lambda does not, so the runner
    # passes this and the student process applies it before the student's code.
    cap = os.environ.pop("SANDBOX_NPROC", "")
    if not cap.isdigit():
        return
    import resource
    n = int(cap)
    try:
        resource.setrlimit(resource.RLIMIT_NPROC, (n, n))
    except (ValueError, OSError):
        pass


def produce(payload):
    # Student code runs in the forked process. It is not given the expected
    # values. Whatever it writes is not a pass: the parent compares each actual.
    apply_process_cap()
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


def _network_syscalls():
    import platform
    machine = platform.machine()
    # io_uring can open a socket too, so it is denied on both architectures.
    if machine in ("x86_64", "amd64"):
        return [41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 288, 425, 426, 427]
    if machine in ("aarch64", "arm64"):
        return [198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 242, 425, 426, 427]
    return []


def deny_network():
    # Lambda runs this process as an unprivileged user, so chroot is refused
    # there. A filter installed by the student process itself still stops new
    # sockets. Docker already has no network; the filter is the same rule.
    syscalls = _network_syscalls()
    if not syscalls:
        return
    try:
        import ctypes
        libc = ctypes.CDLL(None, use_errno=True)
        if libc.prctl(38, 1, 0, 0, 0) != 0:
            return
    except Exception:
        return

    class SockFilter(ctypes.Structure):
        _fields_ = [
            ("code", ctypes.c_uint16),
            ("jt", ctypes.c_uint8),
            ("jf", ctypes.c_uint8),
            ("k", ctypes.c_uint32),
        ]

    class SockFprog(ctypes.Structure):
        _fields_ = [("len", ctypes.c_ushort), ("filter", ctypes.POINTER(SockFilter))]

    instructions = [
        SockFilter(0x20, 0, 0, 4),
        SockFilter(0x15, 1, 0, 0xC000003E if syscalls[0] == 41 else 0xC00000B7),
        SockFilter(0x06, 0, 0, 0x7FFF0000),
        SockFilter(0x20, 0, 0, 0),
    ]
    for number in syscalls:
        instructions.append(SockFilter(0x15, 0, 1, number))
        instructions.append(SockFilter(0x06, 0, 0, 0x00050001))
    instructions.append(SockFilter(0x06, 0, 0, 0x7FFF0000))
    program = (SockFilter * len(instructions))(*instructions)
    fprog = SockFprog(len(instructions), program)
    try:
        libc.prctl(22, 2, ctypes.byref(fprog), 0, 0)
    except Exception:
        return


def confine():
    import resource
    # The interpreter is already running. Enter the jail now, so the exec did
    # not have to succeed from inside it. Lambda refuses chroot and setuid, so
    # there the student stays in a private directory of the temporary folder.
    if os.path.isdir("/opt/jail"):
        jailed = False
        try:
            os.chroot("/opt/jail")
            jailed = True
        except OSError:
            jailed = False
        if jailed:
            os.chdir("/tmp")
            os.setgid(65534)
            os.setuid(65534)
            resource.setrlimit(resource.RLIMIT_AS, (guard.MEMORY_BYTES, guard.MEMORY_BYTES))
        else:
            workspace = "/tmp/colearner-student"
            os.makedirs(workspace, exist_ok=True)
            try:
                os.chmod(workspace, 0o700)
            except OSError:
                pass
            os.chdir(workspace)
            try:
                resource.setrlimit(resource.RLIMIT_AS, (guard.MEMORY_BYTES, guard.MEMORY_BYTES))
            except (ValueError, OSError):
                pass
    # The hard limit is one second higher so a busy loop receives SIGXCPU, the
    # time signal, rather than an immediate SIGKILL. A process cap is not set
    # here: it would count every process of this user on the machine, and the
    # container's pid limit is the cap. Lambda sets SANDBOX_NPROC instead,
    # applied in the student process so this fork can still happen.
    resource.setrlimit(resource.RLIMIT_CPU, (guard.SECONDS, guard.SECONDS + 1))
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
    resource.setrlimit(resource.RLIMIT_FSIZE, (8 * 1024 * 1024, 8 * 1024 * 1024))


def score(tests, out, returncode):
    if returncode is not None and returncode < 0:
        if -returncode in (signal.SIGXCPU, signal.SIGALRM):
            return {"outcome": "refused", "message": guard.TOOK_TOO_LONG}
        return {"outcome": "refused", "message": guard.USED_TOO_MUCH_MEMORY}
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


def _detach_runner_pipes():
    # fd 0 and fd 2 still lead to the runner. A fork would copy them, and the
    # runner would wait until its 10 second limit.
    try:
        null_in = os.open("/dev/null", os.O_RDONLY)
        null_out = os.open("/dev/null", os.O_WRONLY)
    except OSError:
        for fd in (0, 2):
            try:
                os.close(fd)
            except OSError:
                pass
        return
    os.dup2(null_in, 0)
    os.dup2(null_out, 2)
    os.close(null_in)
    os.close(null_out)


def _drop_inherited_stdio():
    for fd in (0, 1, 2):
        try:
            os.close(fd)
        except OSError:
            pass


def _read_student_report(read_fd):
    import select
    import time
    deadline = time.monotonic() + guard.SECONDS
    chunks = []
    while b"\n" not in b"".join(chunks):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return None
        ready, _, _ = select.select([read_fd], [], [], remaining)
        if not ready:
            return None
        chunk = os.read(read_fd, 65536)
        if not chunk:
            break
        chunks.append(chunk)
    return b"".join(chunks).split(b"\n", 1)[0]


def _write_report(payload):
    os.write(1, (json.dumps(payload) + "\n").encode())


def supervise(payload):
    # Fork inside the jail. The student process returns actual values only.
    confine()
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
            _detach_runner_pipes()
            os.register_at_fork(after_in_child=_drop_inherited_stdio)
            deny_network()
            _write_report(produce(student))
            os._exit(0)
        except MemoryError:
            try:
                _write_report({"outcome": "refused", "message": guard.USED_TOO_MUCH_MEMORY})
            except Exception:
                pass
            os._exit(2)
        except Exception:
            import traceback
            traceback.print_exc()
            try:
                _write_report(could_not_check())
            except Exception:
                pass
            os._exit(1)
    os.close(write_fd)
    report = _read_student_report(read_fd)
    os.close(read_fd)
    if report is None:
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        os.waitpid(pid, 0)
        return {"outcome": "refused", "message": guard.TOOK_TOO_LONG}
    _, status = os.waitpid(pid, 0)
    return score(tests, report, os.waitstatus_to_exitcode(status))


def main():
    payload = json.load(sys.stdin)
    emit(supervise(payload))


if __name__ == "__main__":
    try:
        main()
    except MemoryError:
        emit({"outcome": "refused", "message": guard.USED_TOO_MUCH_MEMORY})
    except Exception:
        import traceback
        traceback.print_exc()
        emit(could_not_check())
