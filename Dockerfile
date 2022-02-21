FROM node:14-alpine
ENV NODE_ENV="production"
COPY package.json .
RUN npm install
COPY . .

ENTRYPOINT [ "node", "index.js" ]