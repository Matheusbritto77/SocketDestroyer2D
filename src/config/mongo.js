require("dotenv").config();
const { MongoClient } = require("mongodb");

const mongoUrl = process.env.MONGO_EXTERNAL_URL;
const mongoClient = new MongoClient(mongoUrl);

async function connectMongo() {
  try {
    await mongoClient.connect();
    console.log("Conectado ao MongoDB!");
  } catch (err) {
    console.error("Erro ao conectar ao MongoDB:", err);
  }
}

connectMongo();

module.exports = mongoClient;
