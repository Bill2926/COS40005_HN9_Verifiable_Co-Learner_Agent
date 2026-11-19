FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends binutils libcurl4 \
    && rm -rf /var/lib/apt/lists/*

COPY guard.py runner.py child.py handler.py build-jail.py entrypoint.sh /opt/sandbox/
RUN python3 /opt/sandbox/build-jail.py \
    && cp /opt/sandbox/child.py /opt/jail/child.py \
    && cp /opt/sandbox/guard.py /opt/jail/guard.py \
    && chmod 755 /opt/jail/child.py /opt/jail/guard.py /opt/sandbox/entrypoint.sh \
    && chmod 1777 /opt/jail/tmp \
    && pip install --no-cache-dir 'awslambdaric==4.2.3'

USER root
ENTRYPOINT ["/opt/sandbox/entrypoint.sh"]
