#!/usr/bin/env bash

# Load DATABASE_URL from .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Please set it in your .env file."
  exit 1
fi

# Parse DATABASE_URL: postgresql://user:password@host:port/dbname
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASSWORD=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

CONTAINER_NAME="pinitia-postgres"

if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Please start Docker and try again."
  exit 1
fi

EXISTING=$(docker ps -a --filter "name=^${CONTAINER_NAME}$" --format '{{.Names}}')

if [ "$EXISTING" = "$CONTAINER_NAME" ]; then
  RUNNING=$(docker ps --filter "name=^${CONTAINER_NAME}$" --format '{{.Names}}')
  if [ "$RUNNING" != "$CONTAINER_NAME" ]; then
    echo "Starting existing container '$CONTAINER_NAME'..."
    docker start "$CONTAINER_NAME"
  else
    echo "Container '$CONTAINER_NAME' is already running."
  fi
else
  echo "Creating new container '$CONTAINER_NAME'..."
  docker run -d \
    --name "$CONTAINER_NAME" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_DB="$DB_NAME" \
    -p "$DB_PORT":5432 \
    postgres:16-alpine
fi

# Wait for DB to be ready
echo "Waiting for database to be ready..."
RETRIES=10
until docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  RETRIES=$((RETRIES - 1))
  sleep 1
done

if [ $RETRIES -eq 0 ]; then
  echo "Database did not become ready in time."
  exit 1
fi

echo "Database is ready."
