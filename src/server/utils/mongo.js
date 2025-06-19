const mongoClient = require('../../config/mongo');

const dbName = process.env.MONGO_DB || 'chatdb';

async function getMessagesCollection(roomId) {
  const db = mongoClient.db(dbName);
  return db.collection('messages_' + roomId);
}

async function dropMessagesCollection(roomId) {
  const db = mongoClient.db(dbName);
  await db.collection('messages_' + roomId).drop().catch(() => {});
}

module.exports = { getMessagesCollection, dropMessagesCollection }; 