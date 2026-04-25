const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, 'cinematic')));
app.use(express.static(__dirname));

const url = process.env.MONGO_URL;
const client = new MongoClient(url, {
  tlsAllowInvalidCertificates: true
});
const dbName = 'autocraft_db';

let db;

async function connectToMongo() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    db = client.db(dbName);
    
    // Create Unique Indexes
    try {
      await db.collection('customers').createIndex({ vehicle_number: 1 }, { unique: true });
      await db.collection('workers').createIndex({ worker_id: 1 }, { unique: true });
      await db.collection('jobs').createIndex({ id: 1 });
      await db.collection('bills').createIndex({ job_id: 1 }, { unique: true });
    } catch(e) { console.warn('Indexes already exist or error:', e.message); }

  } catch (err) {
    console.warn('⚠️ MongoDB Connection Error (Server still running):', err.stack);
  }
}
connectToMongo();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'cinematic', 'index.html'));
});

app.get('/workshop', (req, res) => {
  res.sendFile(path.join(__dirname, 'main.html'));
});

// Generic CRUD endpoints with manual joins for 'jobs'
app.get('/api/:collection', async (req, res) => {
  try {
    const colName = req.params.collection;
    let query = { ...req.query };
    
    // Cleanup internal query params
    const limit = parseInt(query._limit) || 100;
    delete query._limit;
    delete query._count;
    const orQuery = query._or;
    delete query._or;

    // Build Mongo Query
    let mongoQuery = {};
    if (orQuery) {
        // Very basic OR handling for search: e.g. "name.ilike.%alice%,vehicle_number.ilike.%alice%"
        // Parse out encoded % symbols if necessary
        const parts = orQuery.split(',');
        mongoQuery.$or = parts.map(p => {
            const match = p.match(/^([^.]+)\.ilike\.(.*)$/);
            if (match) {
                return { [match[1]]: { $regex: match[2].replace(/%/g, ''), $options: 'i' } };
            }
            return {};
        });
    }

    Object.keys(query).forEach(key => {
        if (key.includes('.ilike')) {
            const field = key.split('.')[0];
            mongoQuery[field] = { $regex: query[key].replace(/%/g, ''), $options: 'i' };
        } else if (key.includes('.in')) {
            const field = key.split('.')[0];
            const vals = query[key].replace(/[()"]/g, '').split(',');
            mongoQuery[field] = { $in: vals };
        } else if (key.includes('.neq')) {
            const field = key.split('.')[0];
            mongoQuery[field] = { $ne: query[key] };
        } else {
            mongoQuery[key] = query[key];
        }
    });

    if (mongoQuery.id) {
        try { mongoQuery._id = new ObjectId(mongoQuery.id); } catch(e) {}
        delete mongoQuery.id;
    }

    let results = await db.collection(colName).find(mongoQuery).sort({ created_at: -1 }).limit(limit).toArray();
    
    // Manual Joins for Jobs & History
    if (colName === 'jobs' || colName === 'history') {
        for (let item of results) {
            if (item.customer_id) {
                try { item.customers = await db.collection('customers').findOne({ _id: new ObjectId(item.customer_id) }); } catch(e) {
                    item.customers = await db.collection('customers').findOne({ id: item.customer_id });
                }
            }
            if (item.worker_id) {
                try { item.workers = await db.collection('workers').findOne({ _id: new ObjectId(item.worker_id) }); } catch(e) {
                    item.workers = await db.collection('workers').findOne({ id: item.worker_id });
                }
            }
            if (colName === 'jobs') {
                item.bills = await db.collection('bills').find({ job_id: item._id.toString() }).toArray();
            }
        }
    }

    const data = results.map(item => ({ ...item, id: item._id.toString() }));
    res.json({ data, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: { message: err.message } });
  }
});

app.post('/api/:collection', async (req, res) => {
  try {
    const colName = req.params.collection;
    const body = { ...req.body, created_at: new Date() };
    if (body.id) delete body.id;
    
    const result = await db.collection(colName).insertOne(body);
    const inserted = await db.collection(colName).findOne({ _id: result.insertedId });
    if (inserted) inserted.id = inserted._id.toString();
    
    res.json({ data: inserted, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: { message: err.message, code: err.code } });
  }
});

app.patch('/api/:collection', async (req, res) => {
    try {
        const colName = req.params.collection;
        const body = { ...req.body, updated_at: new Date() };
        delete body._id;
        delete body.id;
        
        let query = { ...req.query };
        if (query.id) {
            try { query._id = new ObjectId(query.id); } catch(e) {}
            delete query.id;
        }

        await db.collection(colName).updateMany(query, { $set: body });

        // AUTOMATIC HISTORY RECORDING
        if (colName === 'jobs' && body.status === 'delivered') {
            const job = await db.collection('jobs').findOne(query);
            if (job) {
                const historyEntry = {
                    job_id: job._id.toString(),
                    customer_id: job.customer_id,
                    worker_id: job.worker_id,
                    vehicle_number: job.vehicle_number,
                    car_model: job.car_model,
                    service_details: job.work_items,
                    total_cost: job.total_est || 0,
                    completed_at: new Date()
                };
                // Find worker name for history log
                try {
                   const worker = await db.collection('workers').findOne({ id: job.worker_id });
                   if (worker) historyEntry.worker_name = worker.name;
                } catch(e) {}
                
                await db.collection('history').insertOne(historyEntry);
                console.log(`📜 History logged for vehicle ${job.vehicle_number}`);
            }
        }

        res.json({ data: { success: true }, error: null });
    } catch (err) {
        res.status(500).json({ data: null, error: { message: err.message } });
    }
});

app.put('/api/:collection', async (req, res) => {
    try {
        const colName = req.params.collection;
        const body = { ...req.body, updated_at: new Date() };
        delete body._id;
        delete body.id;
        
        const filter = {};
        if (req.body.job_id) filter.job_id = req.body.job_id;
        if (req.body.vehicle_number) filter.vehicle_number = req.body.vehicle_number;
        if (req.body.worker_id) filter.worker_id = req.body.worker_id;

        const result = await db.collection(colName).findOneAndUpdate(
            filter,
            { $set: body },
            { upsert: true, returnDocument: 'after' }
        );
        const data = result.value || result;
        if (data && data._id) data.id = data._id.toString();
        
        res.json({ data, error: null });
    } catch (err) {
        res.status(500).json({ data: null, error: { message: err.message } });
    }
});

// Authentication endpoints
app.post('/api/auth/worker', async (req, res) => {
  const { worker_id, password } = req.body;
  try {
    const result = await db.collection('workers').findOne({ worker_id, password });
    if (!result) return res.status(401).json({ data: null, error: { message: 'Invalid ID or password' } });
    result.id = result._id.toString();
    res.json({ data: result, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: { message: err.message } });
  }
});

app.post('/api/auth/customer', async (req, res) => {
  const { vehicle_number } = req.body;
  try {
    const result = await db.collection('customers').findOne({ vehicle_number });
    if (!result) return res.status(401).json({ data: null, error: { message: 'Vehicle not found' } });
    result.id = result._id.toString();
    res.json({ data: result, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// Export for Vercel serverless
module.exports = app;

// Local development server
if (require.main === module) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server running on networking. Visit http://localhost:${port} or your IP [DB: MongoDB Atlas]`);
  });
}
