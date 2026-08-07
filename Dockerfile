FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL=/api/v1
ARG NEXT_PUBLIC_APP_NAME=Vitalnova
# BACKEND_INTERNAL_URL debe estar disponible en el BUILD: los rewrites() de Next
# se resuelven al compilar. Railway lo pasa como build arg si es service variable.
ARG BACKEND_INTERNAL_URL=http://backend:8181
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3131
ENV PORT 3131
ENV HOSTNAME "0.0.0.0"
CMD ["node", "server.js"]
