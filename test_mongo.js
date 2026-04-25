const { MongoClient } = require('mongodb');
require('dotenv').config();

const url = process.env.MONGO_URL;
// Disabling certificate validation due to system clock mismatch
const client = new MongoClient(url, {
  tlsAllowInvalidCertificates: true
});

async function test() {
  try {
    console.log('Connecting to MongoDB Atlas (SSL bypassing)...');
    await client.connect();
    console.log('✅ Connection Successful!');
    
    const db = client.db('autocraft_db');
    const cols = await db.listCollections().toArray();
    console.log('✅ Collections:', cols.map(c => c.name));
    
    // Ensure history exists by inserting a system record
    const historyCount = await db.collection('history').countDocuments();
    if (historyCount === 0) {
      await db.collection('history').insertOne({
        job_id: "sys_init",
        car_model: "AutoCraft Boot",
        vehicle_number: "INIT-001",
        service_details: "System Initialized: History collection created.",
        completed_at: new Date()
      });
      console.log("✅ Created 'history' collection with initial record.");
    }
    
    await client.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
}

test();
