FROM node:8

ENV HOST localhost
ENV PORT 3000

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install GYP dependencies globally, will be used to code build other dependencies
RUN yarn global add node-gyp

# Install app dependencies
COPY package.json /usr/src/app
RUN yarn install && \
    yarn add redis talib tulind pg

# Bundle app source
COPY . /usr/src/app

EXPOSE 3000
RUN chmod +x /usr/src/app/docker-entrypoint.sh
ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]


CMD [ "yarn", "start" ]