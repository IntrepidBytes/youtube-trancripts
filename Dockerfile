# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with clean up
RUN npm ci && \
    npm cache clean --force

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built assets from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 