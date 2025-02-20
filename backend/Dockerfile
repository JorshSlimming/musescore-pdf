# Usamos una imagen con Node 18 basada en Debian
FROM node:18-slim

# Definir el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar solo los archivos de package.json y package-lock.json (si existe)
COPY backend/package*.json ./

# Instalar dependencias del sistema necesarias para Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Instalar las dependencias de Node.js
RUN npm install

# Copiar el resto del código del backend
COPY backend/ . 

# Exponer el puerto en el que corre el backend (si es necesario)
EXPOSE 3000

# Comando para ejecutar el servidor
CMD ["node", "server.js"]
