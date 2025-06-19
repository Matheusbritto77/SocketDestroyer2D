require("dotenv").config();
const { Client } = require("pg");

const pgClient = new Client({
  host: process.env.PG_EXTERNAL_HOST,
  port: process.env.PG_EXTERNAL_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

pgClient
  .connect()
  .then(() => console.log("Conectado ao PostgreSQL!"))
  .catch((err) => console.error("Erro ao conectar ao PostgreSQL:", err));

module.exports = pgClient;
