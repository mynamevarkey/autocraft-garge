require('dotenv').config();
const { MongoClient } = require('mongodb');

async function run() {
    const client = new MongoClient(process.env.MONGO_URL || 'mongodb+srv://gfwgwgr3_db_user:LDILkEiXeHJfiBpi@cluster0.nvqde5h.mongodb.net/?appName=Cluster0');
    try {
        await client.connect();
        const db = client.db('autocraft_db'); // confirmed from previous context
        
        const dummyHistory = {
            job_id: "init_system",
            customer_id: "system",
            worker_id: "system",
            vehicle_number: "SYSTEM-INIT",
            car_model: "AutoCraft System",
            service_details: "Database Initialization: Car History Tracking Enabled.",
            total_cost: 0,
            completed_at: new Date()
        };

        const result = await db.collection('history').insertOne(dummyHistory);
        console.log(`✅ Success: 'history' collection created with dummy record. ID: ${result.insertedId}`);
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}
run();
