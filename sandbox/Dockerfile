FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends binutils \
    && rm -rf /var/lib/apt/lists/*

COPY guard.py runner.py child.py build-jail.py /opt/sandbox/
RUN python3 /opt/sandbox/build-jail.py \
    && cp /opt/sandbox/child.py /opt/jail/child.py \
    && cp /opt/sandbox/guard.py /opt/jail/guard.py \
    && chmod 755 /opt/jail/child.py /opt/jail/guard.py \
    && chmod 1777 /opt/jail/tmp

USER root
ENTRYPOINT ["python3", "-I", "/opt/sandbox/runner.py"]
