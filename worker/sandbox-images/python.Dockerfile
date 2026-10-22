FROM python:3.12-slim

# No .pyc files, because the container's filesystem is read-only. Unbuffered output, so
# whatever was printed before a timeout or crash is not lost
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Unprivileged user: submitted programs never run as root. No home directory, no login shell
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin runner

USER runner
WORKDIR /work