const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const client = new MongoClient(process.env.MONGO_URL, { tlsAllowInvalidCertificates: true });
async function debug() {
  await client.connect();
  const db = client.db('autocraft_db');
  const jobs = await db.collection('jobs').find().toArray();
  const customers = await db.collection('customers').find().toArray();
  console.log('--- CURSOR CHECK ---');
  console.log('Jobs:', JSON.stringify(jobs, null, 2));
  console.log('Customers:', JSON.stringify(customers, null, 2));
  await client.close();
}
debug();
