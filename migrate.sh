#!/bin/bash

cleanup() {
    echo -e "\nShutting down. Stopping the database..."
    docker compose -f dev-docker-compose.yml down
    exit
}

trap cleanup SIGINT SIGTERM EXIT

echo -n "Enter migration name (or press Enter for 'auto'): "
read MIGRATION_NAME

if [ -z "$MIGRATION_NAME" ]; then
    MIGRATION_NAME="auto"
fi

echo "Starting database for migration..."
docker compose -f dev-docker-compose.yml up postgres -d --wait

echo "Running Prisma Migrate via Turborepo..."

npx turbo run db:migrate -- --name "$MIGRATION_NAME"

echo "Migrations applied successfully!"