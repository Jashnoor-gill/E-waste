FROM node:18-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "index.js"]
