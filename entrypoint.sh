#!/bin/sh

# Jalankan migrasi database
pnpm prisma migrate deploy

# Generate Prisma client (untuk memastikan)
pnpm prisma generate

# Jalankan aplikasi
exec pnpm dev