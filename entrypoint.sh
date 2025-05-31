#!/bin/sh

# Wait for PostgreSQL
while ! nc -z postgres 5432; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done


# Run migrations
pnpm prisma migrate deploy

# Start app
exec pnpm start