# Stage 1: build
# python3, make y g++ son necesarios para compilar los bindings nativos de better-sqlite3.
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: runner
# Solo contiene el artefacto compilado y node_modules (con bindings ya compilados).
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
