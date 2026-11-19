#!/bin/sh
set -eu
if [ -n "${AWS_LAMBDA_RUNTIME_API:-}" ]; then
  cd /opt/sandbox
  export PYTHONPATH=/opt/sandbox
  exec python3 -m awslambdaric handler.handler
fi
exec python3 -I /opt/sandbox/runner.py
