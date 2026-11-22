#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
umask 077

root="${BACKUP_DIR:-/var/lib/maat/backups}"
mkdir -p "$root"
root="$(cd "$root" && pwd)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$root/$stamp"
work="$root/.$stamp.partial"
paused=""

cleanup() {
    if [ -n "$paused" ]; then
        docker compose unpause "$paused" > /dev/null || true
    fi
    rm -rf "$work"
}
trap cleanup EXIT
mkdir "$work"

docker compose exec -T mongo sh -c 'exec mongodump --quiet -u maat -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db maat --archive --gzip' > "$work/mongo.archive.gz"
docker compose exec -T mongo sh -c 'exec mongorestore --quiet -u maat -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --dryRun' < "$work/mongo.archive.gz"

for service in redis minio; do
    container="$(docker compose ps -q "$service")"
    docker compose pause "$service" > /dev/null
    paused="$service"
    docker run --rm --network none --volumes-from "$container:ro" --entrypoint tar redis:7-alpine -czf - -C /data . > "$work/$service.tar.gz"
    docker compose unpause "$service" > /dev/null
    paused=""
    tar -tzf "$work/$service.tar.gz" > /dev/null
done

(cd "$work" && sha256sum mongo.archive.gz redis.tar.gz minio.tar.gz > SHA256SUMS)
mv "$work" "$target"
find "$root" -mindepth 1 -maxdepth 1 -type d -name '20*Z' -mtime +13 -exec rm -rf {} +
echo "Backup verified: $target"
