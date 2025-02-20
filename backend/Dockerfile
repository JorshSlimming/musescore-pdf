FROM node:18-slim

WORKDIR /app

# Copiar solo los archivos necesarios del backend
COPY package*.json ./ 

# Instalar dependencias de Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends

RUN npm install

# Copiar todo el backend
COPY backend/ . 

CMD ["node", "server.js"]