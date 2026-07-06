#!/bin/sh
set -e

BACKEND_HOST="${BACKEND_HOST:-nexus-media}"
BACKEND_PORT="${BACKEND_PORT:-8080}"

export BACKEND_HOST BACKEND_PORT

envsubst '${BACKEND_HOST} ${BACKEND_PORT}' \
    < /etc/nginx/nginx.conf.template \
    > /etc/nginx/nginx.conf

exec nginx -g "daemon off;"
