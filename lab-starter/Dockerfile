FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Set environment variables (Cloud Run sets PORT automatically, defaults to 8080)
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Start application
CMD ["npm", "start"]
