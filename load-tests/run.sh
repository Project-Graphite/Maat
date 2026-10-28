#!/usr/bin/env bash
# Runs the judging load test with 1, 2, 4 and 8 workers, then the reading load test, and prints
# one result line per run. Run it from anywhere: bash load-tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."

WORKERS="${WORKERS:-1 2 4 8}"
RATE="${RATE:-3}"                 # submissions per second
DURATION="${DURATION:-60s}"
USERS="${USERS:-40}"
DRAIN_TIMEOUT="${DRAIN_TIMEOUT:-900}"
export LOAD_TEST_PASSWORD="${LOAD_TEST_PASSWORD:-load-test-password}"
# The model server: every sandbox shares these 4 cores, and one IP may send as much as it likes
export SANDBOX_CPUSET="${SANDBOX_CPUSET:-0-3}"
export API_RATE_LIMIT=1000000
export MSYS_NO_PATHCONV=1         # Git Bash on Windows: leave container paths alone

MONGO_PASSWORD="$(grep -E '^MONGO_PASSWORD' .env | cut -d= -f2- | tr -d ' \r')"
SCRIPTS="$(pwd -W 2>/dev/null || pwd)/load-tests"
mongo() { docker compose exec -T mongo mongosh -u maat -p "$MONGO_PASSWORD" --authenticationDatabase admin maat --quiet "$@"; }
k6() { docker run --rm --add-host=host.docker.internal:host-gateway -v "$SCRIPTS:/scripts:ro" \
    -e BASE_URL=http://host.docker.internal:8080 -e LOAD_TEST_PASSWORD -e USERS -e RATE -e DURATION \
    grafana/k6:0.57.0 run --quiet "$@" | grep K6_RESULT | cut -d' ' -f2-; }

echo "Starting the stack with the load test settings"
docker compose up -d --build backend frontend worker >/dev/null
sleep 10
docker compose exec -T -e SEED_LOAD_USERS="$USERS" -e LOAD_TEST_PASSWORD backend node seed.js >/dev/null

for n in $WORKERS; do
    docker compose up -d --scale worker="$n" --no-recreate worker >/dev/null
    sleep 15                      # each worker measures its startup cost before taking jobs
    since="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
    accept="$(k6 /scripts/submit.js)"

    # Wait until every submission from this run has a verdict
    for ((t = 0; t < DRAIN_TIMEOUT; t += 5)); do
        left="$(mongo --eval "const u=db.users.find({email:/^loadtest-/}).toArray().map(x=>x._id); print(db.submissions.countDocuments({userId:{\$in:u}, submittedAt:{\$gte:new Date('$since')}, status:{\$in:['PENDING','RUNNING']}}))")"
        [ "$left" = "0" ] && break
        sleep 5
    done
    judged="$(mongo --eval "const since = new Date('$since'); $(cat load-tests/measure.js)")"
    echo "workers=$n accept=$accept judged=$judged"
done

echo "reading load: $(RATE="${BROWSE_RATE:-100}" k6 /scripts/browse.js)"

docker compose up -d --scale worker=1 worker >/dev/null
mongo --eval "$(cat load-tests/cleanup.js)"
echo "Done. Restart the stack with your normal settings: docker compose up -d"
