FROM node:20-bookworm

WORKDIR /app

COPY package.json package-lock.json* ./

# Install build tools and canvas dependencies
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    make \
    g++ \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    libpixman-1-dev \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --production

COPY . .

CMD ["node", "index.js"]