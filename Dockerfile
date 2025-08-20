# ============================
# Etapa 1: Construcción
# ============================
FROM node:21-alpine AS builder

WORKDIR /usr/src/clients_microservice

# Copiar solo archivos de dependencias primero para aprovechar la cache
COPY package*.json ./

RUN npm install --legacy-peer-deps

# Copiar el resto del código
COPY . .

# Si necesitas compilar (TypeScript, build Vue, etc.), hazlo aquí
# RUN npm run build

# ============================
# Etapa 2: Producción
# ============================
FROM node:21-alpine AS production

WORKDIR /usr/src/clients_microservice

# Copiar solo dependencias necesarias para producción
COPY package*.json ./

RUN npm install --production --legacy-peer-deps

# Copiar el código compilado o necesario desde el builder
COPY --from=builder /usr/src/clients_microservice ./

EXPOSE 3007
