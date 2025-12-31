# write the docker file to run the main.js file

FROM oven/bun:slim
WORKDIR /app
COPY package.json main.js ./
RUN bun install
COPY . .
CMD ["bun", "main.js"]