# Use a lightweight Node.js image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# If the service uses Prisma, generate the Prisma Client
RUN if [ -d "prisma" ]; then npx prisma generate; fi

# Command to run the service
CMD ["node", "server.js"]