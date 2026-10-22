FROM gcc:13-bookworm

# Unprivileged user: submitted programs never run as root. No home directory, no login shell
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin runner

USER runner
WORKDIR /work