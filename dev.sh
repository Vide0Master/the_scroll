#!/bin/bash

cleanup() {
    echo -e "\nStopping docker dev containers..."
    docker compose -f dev-docker-compose.yml down 
    exit
}

trap cleanup SIGINT SIGTERM EXIT

echo "Starting dev containers..."
docker compose -f dev-docker-compose.yml up  -d --wait

echo "Starting services in dev mode..."
npx turbo run dev

wait