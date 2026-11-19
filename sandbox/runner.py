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


def child_env():
    env = {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "HOME": "/tmp",
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONNOUSERSITE": "1",
        "PYTHONSAFEPATH": "1",
        "PYTHONUNBUFFERED": "1",
    }
    # Docker caps processes on the container. Lambda does not, so the child
    # applies the same cap and then drops this variable before student code.
    if os.environ.get("AWS_LAMBDA_RUNTIME_API"):
        env["SANDBOX_NPROC"] = "32"
    return env


def run_child(payload, log_errors=False):
    # Start the interpreter that is already running. Chroot happens inside
    # child.py, after this process is up: doing it here made the exec look
    # inside the jail and every image check came back unchecked.
    proc = subprocess.Popen(
        [sys.executable, "-I", CHILD],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=child_env(),
        start_new_session=True,
    )
    try:
        out, err = proc.communicate(json.dumps(payload).encode(), timeout=guard.SECONDS)
    except subprocess.TimeoutExpired:
        kill_group(proc.pid)
        proc.wait()
        clean_tmp()
        return {"outcome": "refused", "message": guard.TOOK_TOO_LONG}
    if err and log_errors:
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


def check_submission(payload, log_errors=False):
    if not isinstance(payload, dict):
        return {"outcome": "refused", "message": "This submission could not be checked."}
    code = payload.get("code", "")
    tests = payload.get("tests", [])
    if not isinstance(code, str) or not isinstance(tests, list):
        return {"outcome": "refused", "message": "This submission could not be checked."}
    probe = os.environ.get("SANDBOX_PROBE") == "1"
    body = {"code": code, "tests": tests}
    if probe:
        body["confineOnly"] = True
    else:
        found = guard.first_disallowed(code)
        if found:
            return {"outcome": "refused", "message": guard.refusal(found[0])}
    return run_child(body, log_errors=log_errors)


def main():
    # The local image writes the report to stdout. The Lambda handler does not:
    # CloudWatch stores stdout, and that log must not contain the student's code.
    emit(check_submission(json.load(sys.stdin), log_errors=True))


if __name__ == "__main__":
    main()
