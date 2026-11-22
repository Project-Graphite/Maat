#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ] || [ "$2" != "--yes" ]; then
    echo "usage: bash infra/backup/restore.sh <backup directory> --yes" >&2
    echo "This replaces every account, problem, submission, standing and photo with the backup's." >&2
    exit 1
fi

backup="$(cd "$1" && pwd)"
cd "$(dirname "$0")/../.."

(cd "$backup" && sha256sum -c SHA256SUMS)
docker compose exec -T mongo sh -c 'exec mongorestore --quiet -u maat -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --dryRun' < "$backup/mongo.archive.gz"

docker compose stop frontend backend worker

docker compose exec -T mongo sh -c 'exec mongosh --quiet -u maat -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin maat --eval "db.dropDatabase()"' > /dev/null
docker compose exec -T mongo sh -c 'exec mongorestore --quiet -u maat -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip' < "$backup/mongo.archive.gz"

for service in redis minio; do
    container="$(docker compose ps -aq "$service")"
    docker compose stop "$service"
    docker run --rm -i --network none --volumes-from "$container" --entrypoint sh redis:7-alpine \
        -c 'find /data -mindepth 1 -delete && exec tar -xzf - -C /data' < "$backup/$service.tar.gz"
    docker compose start "$service"
done

docker compose up -d --wait --no-build
echo "Restored: $backup"
