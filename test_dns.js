const dns = require('dns').promises;

async function testSrv() {
  try {
    console.log('Resolving SRV for _mongodb._tcp.cluster0.stiexqn.mongodb.net...');
    const records = await dns.resolveSrv('_mongodb._tcp.cluster0.stiexqn.mongodb.net');
    console.log('✅ Found:', records);
  } catch (e) {
    console.error('❌ Failed:', e.message);
  }
}
testSrv();
