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
CHILD = os.path.join(HERE, "child.py")


def emit(payload):
    json.dump(payload, sys.stdout)
    sys.stdout.flush()


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
    # Start the interpreter that is already running. Chroot happens inside
    # child.py, after this process is up: doing it here made the exec look
    # inside the jail and every image check came back unchecked.
    proc = subprocess.Popen(
        [sys.executable, "-I", CHILD],
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
    )
    try:
        out, err = proc.communicate(json.dumps(payload).encode(), timeout=guard.SECONDS)
    except subprocess.TimeoutExpired:
        kill_group(proc.pid)
        proc.wait()
        clean_tmp()
        return {"outcome": "refused", "message": guard.TOOK_TOO_LONG}
    if err:
        sys.stderr.buffer.write(err)
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
