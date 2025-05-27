FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy all files
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

EXPOSE 3000

# Command untuk development (hot reload)
CMD ["pnpm", "dev"]