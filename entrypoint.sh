#!/bin/sh

# Wait for PostgreSQL
echo "Waiting for PostgreSQL to be ready..."
while ! nc -z postgres 5432; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done
echo "PostgreSQL is up!"


# Deploy migrations
echo "Deploying migrations..."
pnpm prisma migrate deploy

# Generate Prisma client
echo "Generating Prisma client..."
pnpm prisma generate

# Start Next.js app
echo "Starting Next.js application..."
exec pnpm start