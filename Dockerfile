FROM node:14-alpine
ENV NODE_ENV="production"
COPY ["package.json", "package-lock.json*", "./"]
RUN npm install --production
COPY . .

ENTRYPOINT [ "node", "index.js" ]