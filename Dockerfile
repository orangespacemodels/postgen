# Build stage for frontend
FROM node:20-alpine AS frontend-builder

# Build arguments for Vite (needed at build time)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_N8N_WEBHOOK_URL

# Set as environment variables for the build
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
ENV VITE_N8N_WEBHOOK_URL=${VITE_N8N_WEBHOOK_URL}

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application (VITE_* vars are embedded at this step)
RUN npm run build

# Production stage with nginx + python
FROM python:3.11-slim

# Install nginx and supervisor
RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Setup backend
WORKDIR /app/backend

# Copy backend dependencies and install
COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir .

# Copy backend code
COPY backend/app/ ./app/

# Setup frontend
WORKDIR /app

# Copy built frontend files
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Remove default nginx config
RUN rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy supervisor config
RUN mkdir -p /var/log/supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
