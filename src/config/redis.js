require("dotenv").config();
const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_EXTERNAL_URL,
});

redisClient.on("error", (err) => console.error("Erro no Redis:", err));

(async () => {
  await redisClient.connect();
  console.log("Conectado ao Redis!");
})();

module.exports = redisClient;
