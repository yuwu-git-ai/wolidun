# -- Build Stage --
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com
RUN npm ci
COPY . .
RUN npm run build
RUN npx tsc --project tsconfig.server.json

# -- Production Stage --
FROM node:20
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
# Remove "type":"module" so Node treats compiled JS as CommonJS
RUN node -e "const p=require('./package.json'); delete p.type; require('fs').writeFileSync('./package.json', JSON.stringify(p,null,2))"
RUN mkdir -p /app/data
EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/ordering.db
CMD ["node", "dist-server/server/index.js"]
