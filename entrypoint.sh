#!/bin/sh
# Copy .env.example to .env if .env does not exist
if [ ! -f .env ]; then
  echo "Copying .env.example to .env"
  cp .env.example .env
fi
# Wait for PostgreSQL
echo "Waiting for PostgreSQL to be ready..."
while ! nc -z postgres 5432; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done
echo "PostgreSQL is up!"

# Create migration for ingested field if it doesn't exist
#echo "Creating migration for schema changes..."
#pnpm prisma migrate dev --name add_knowledge_base --skip-generate

# Deploy migrations
echo "Deploying migrations..."
pnpm prisma migrate deploy

# Generate Prisma client
echo "Generating Prisma client..."
pnpm prisma generate

# Start ChromaDB in background
echo "Starting ChromaDB server..."
nohup pnpm chroma run --host 0.0.0.0 --port 8000 --path ./db/chroma_langchain_db &

# Wait a moment for ChromaDB to start
sleep 3

# Start Next.js app
echo "Starting Next.js application..."
exec pnpm start