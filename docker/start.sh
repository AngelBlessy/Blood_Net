#!/bin/bash
# Runs the Node API and the Flask ML service as sibling processes in the same
# container. tini (the image's ENTRYPOINT) forwards SIGTERM to this script;
# this script forwards it to both children so `fly deploy` restarts / stops
# shut down cleanly instead of leaving a process behind. If either process
# exits on its own (crash), the other is killed and the container exits so
# Fly's health check fails and restarts it -- silently running Node without
# the ML service is worse than a visible restart.
set -e

python3 ml/app.py &
ML_PID=$!

node server/index.js &
NODE_PID=$!

terminate() {
  kill -TERM "$ML_PID" "$NODE_PID" 2>/dev/null
}
trap terminate TERM INT

wait -n "$ML_PID" "$NODE_PID"
EXIT_CODE=$?
terminate
exit "$EXIT_CODE"
