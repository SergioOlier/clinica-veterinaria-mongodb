'use strict';

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'clinica_veterinaria';

let client = null;
let db = null;

async function connectDB() {
  if (db) return db;
  if (!uri) {
    throw new Error('Falta MONGODB_URI. Copia .env.example como .env y configura la conexión.');
  }

  client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  db = client.db(dbName);
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('La base de datos aún no está conectada. Llama a connectDB() primero.');
  }
  return db;
}

async function closeDB() {
  if (client) await client.close();
  client = null;
  db = null;
}

function toObjectId(id) {
  if (!id || !ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

module.exports = { connectDB, getDb, closeDB, toObjectId, dbName };
