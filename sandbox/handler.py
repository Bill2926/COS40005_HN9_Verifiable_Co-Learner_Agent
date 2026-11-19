import runner

COULD_NOT_CHECK = "This submission could not be checked."


def handler(event, context):
    # Return the report to the invoke caller. Do not print it: Lambda sends
    # stdout and stderr to the log group, and those logs must not contain the
    # student's code.
    try:
        if not isinstance(event, dict):
            return {"outcome": "refused", "message": COULD_NOT_CHECK}
        return runner.check_submission(event, log_errors=False)
    except Exception:
        return {"outcome": "refused", "message": COULD_NOT_CHECK}
