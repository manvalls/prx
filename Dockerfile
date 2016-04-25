FROM node:latest
RUN npm install -g prx
ENTRYPOINT ["prx", "-h", "rdb"]
