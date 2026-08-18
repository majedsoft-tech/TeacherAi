# Use official Node.js standard runtime
FROM node:20-slim

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies (production-friendly)
RUN npm install

# Copy all source files
COPY . .

# Build the client & server
RUN npm run build

# Expose the modern dynamic port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Start the bundled Express server
CMD ["npm", "start"]
