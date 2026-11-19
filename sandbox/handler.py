import json
import os

import runner

COULD_NOT_CHECK = "This submission could not be checked."
# Removed for the duration of the check. The student process has the same user
# as this one on Lambda and could otherwise read them from the process table.
CREDENTIALS = (
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AWS_SECURITY_TOKEN",
    "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
    "AWS_CONTAINER_CREDENTIALS_FULL_URI",
)


def _hide_process():
    # /proc keeps the environment from process start. Mark this process not
    # dumpable, and take the read permission off every environ file we can.
    try:
        import ctypes
        libc = ctypes.CDLL(None, use_errno=True)
        libc.prctl(4, 0, 0, 0, 0)
    except Exception:
        pass
    try:
        entries = os.listdir("/proc")
    except OSError:
        return
    for name in entries:
        if name.isdigit():
            try:
                os.chmod("/proc/" + name + "/environ", 0)
            except OSError:
                pass


def redact(report, secrets):
    if not isinstance(report, dict):
        return report
    try:
        text = json.dumps(report)
    except (TypeError, ValueError):
        return report
    for secret in secrets:
        if isinstance(secret, str) and len(secret) >= 8:
            text = text.replace(secret, "[redacted]")
    try:
        return json.loads(text)
    except ValueError:
        return report


def handler(event, context):
    # Return the report to the invoke caller. Do not print it: Lambda sends
    # stdout and stderr to the log group, and those logs must not contain the
    # student's code.
    _hide_process()
    saved = {}
    for key in CREDENTIALS:
        if key in os.environ:
            saved[key] = os.environ.pop(key)
    try:
        if not isinstance(event, dict):
            return {"outcome": "refused", "message": COULD_NOT_CHECK}
        return redact(runner.check_submission(event, log_errors=False), list(saved.values()))
    except Exception:
        return {"outcome": "refused", "message": COULD_NOT_CHECK}
    finally:
        os.environ.update(saved)
