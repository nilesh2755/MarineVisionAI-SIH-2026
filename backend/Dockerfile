FROM node:20-bullseye AS base

WORKDIR /app

# Native build dependencies required by packages such as
# sharp and onnxruntime-node on some platforms
RUN apt-get update \
    && apt-get install -y python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Build NestJS application
RUN npm run build

# Documentation/default container port
EXPOSE 4000

# Start backend
CMD ["node", "dist/main.js"]
