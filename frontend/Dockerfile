# ConcertMaster Frontend Dockerfile
# Multi-stage build for development and production

# Base Node.js image
FROM node:18-alpine as base

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM node:18-alpine as development

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Development command
CMD ["npm", "start"]

# Build stage
FROM base as builder

WORKDIR /app

# Copy all files
COPY . .

# Install all dependencies for build
RUN npm ci

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine as production

# Copy built assets from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]