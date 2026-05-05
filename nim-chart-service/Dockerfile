FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs ./
ENV NODE_ENV=production
ENV PORT=3080
EXPOSE 3080
USER node
CMD ["node", "server.mjs"]
