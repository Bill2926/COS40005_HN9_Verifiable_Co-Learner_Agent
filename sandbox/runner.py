import json
import os
import shutil
import signal
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import guard

HERE = os.path.dirname(os.path.abspath(__file__))
IN_IMAGE = os.path.isdir("/opt/jail")
CHILD = "/child.py" if IN_IMAGE else os.path.join(HERE, "child.py")
PYTHON = "/usr/local/bin/python3" if IN_IMAGE else sys.executable


def emit(payload):
    json.dump(payload, sys.stdout)
    sys.stdout.flush()


def confine():
    import resource
    if IN_IMAGE:
        os.chroot("/opt/jail")
        os.chdir("/tmp")
        os.setgid(65534)
        os.setuid(65534)
    resource.setrlimit(resource.RLIMIT_CPU, (guard.SECONDS, guard.SECONDS))
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
    resource.setrlimit(resource.RLIMIT_FSIZE, (8 * 1024 * 1024, 8 * 1024 * 1024))
    if IN_IMAGE:
        # Per the nobody user this child just became, so the parent's processes do not count.
        resource.setrlimit(resource.RLIMIT_NPROC, (16, 16))
        resource.setrlimit(resource.RLIMIT_AS, (guard.MEMORY_BYTES, guard.MEMORY_BYTES))


def clean_tmp():
    if not IN_IMAGE:
        return
    root = "/opt/jail/tmp"
    if not os.path.isdir(root):
        return
    for name in os.listdir(root):
        path = os.path.join(root, name)
        try:
            if os.path.isdir(path) and not os.path.islink(path):
                shutil.rmtree(path, ignore_errors=True)
            else:
                os.remove(path)
        except OSError:
            pass


def kill_group(pid):
    try:
        os.killpg(pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass


def run_child(payload):
    proc = subprocess.Popen(
        [PYTHON, "-I", CHILD],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env={
            "PATH": "/usr/local/bin:/usr/bin:/bin",
            "HOME": "/tmp",
            "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONNOUSERSITE": "1",
            "PYTHONSAFEPATH": "1",
            "PYTHONUNBUFFERED": "1",
        },
        start_new_session=True,
        preexec_fn=confine,
    )
    try:
        out, _err = proc.communicate(json.dumps(payload).encode(), timeout=guard.SECONDS)
    except subprocess.TimeoutExpired:
        kill_group(proc.pid)
        proc.wait()
        clean_tmp()
        return {"outcome": "refused", "message": guard.TOOK_TOO_LONG}
    kill_group(proc.pid)
    clean_tmp()
    if proc.returncode is not None and proc.returncode < 0:
        sig = -proc.returncode
        if sig in (signal.SIGXCPU, signal.SIGALRM):
            return {"outcome": "refused", "message": guard.TOOK_TOO_LONG}
        return {"outcome": "refused", "message": guard.USED_TOO_MUCH_MEMORY}
    if len(out) > guard.OUTPUT_LIMIT:
        return {"outcome": "refused", "message": guard.PRINTED_TOO_MUCH}
    try:
        return json.loads(out.decode("utf-8", errors="replace").strip())
    except json.JSONDecodeError:
        return {"outcome": "refused", "message": "This submission could not be checked."}


def main():
    probe = os.environ.get("SANDBOX_PROBE") == "1"
    payload = json.load(sys.stdin)
    code = payload.get("code", "")
    tests = payload.get("tests", [])
    body = {"code": code, "tests": tests}
    if probe:
        body["confineOnly"] = True
    else:
        found = guard.first_disallowed(code)
        if found:
            emit({"outcome": "refused", "message": guard.refusal(found[0])})
            return
    emit(run_child(body))


if __name__ == "__main__":
    main()
