FROM node:20-alpine

# Install openssl for Prisma engine in alpine
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Generate Prisma Client for Alpine Linux
RUN npx prisma generate

# Set environment variables (Cloud Run sets PORT automatically, defaults to 8080)
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Start application
CMD ["node", "server.js"]
