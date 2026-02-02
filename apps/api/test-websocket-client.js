/**
 * Test WebSocket client for ClawTrade real-time events
 * Run: node test-websocket-client.js
 */

const { io } = require('socket.io-client');

const API_URL = 'http://localhost:4000';

// Use the JWT token from our test agent (you'll need to authenticate first)
// For now, we'll get a token by authenticating
async function getAuthToken() {
  // This is the API key from our test agent registration
  const apiKey = 'ct_12718474453fd88a1f46c91bd0ee96a43d85dd2c3f42c8f2ab37b57e2b8e0da7';

  const response = await fetch(`${API_URL}/api/v1/agents/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });

  if (!response.ok) {
    throw new Error('Authentication failed');
  }

  const data = await response.json();
  return data.data.token;
}

async function testWebSocket() {
  console.log('\n🧪 Testing ClawTrade WebSocket Connection\n');
  console.log('='.repeat(60));

  // Get auth token
  console.log('\n1️⃣  Authenticating...');
  let token;
  try {
    token = await getAuthToken();
    console.log(`   ✅ Got JWT token: ${token.slice(0, 30)}...`);
  } catch (error) {
    console.error('   ❌ Authentication failed:', error.message);
    console.log('\n   Note: You need to run test-agent-registration.js first');
    console.log('   to create an agent and get an API key.\n');
    process.exit(1);
  }

  // Connect to WebSocket
  console.log('\n2️⃣  Connecting to WebSocket...');
  const socket = io(API_URL, {
    path: '/ws',
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  // Connection events
  socket.on('connect', () => {
    console.log(`   ✅ Connected! Socket ID: ${socket.id}`);
  });

  socket.on('connected', (data) => {
    console.log('\n3️⃣  Received welcome message:');
    console.log(`   Agent ID: ${data.agentId}`);
    console.log(`   Username: ${data.username}`);
    console.log(`   Message: ${data.message}`);
  });

  socket.on('connect_error', (error) => {
    console.error('   ❌ Connection error:', error.message);
    process.exit(1);
  });

  socket.on('disconnect', (reason) => {
    console.log(`\n   🔌 Disconnected: ${reason}`);
  });

  // Listen for real-time events
  console.log('\n4️⃣  Listening for real-time events...\n');

  socket.on('trade:indexed', (data) => {
    console.log('   📊 TRADE INDEXED:');
    console.log(`      Agent: ${data.agentId}`);
    console.log(`      TX Hash: ${data.trade.txHash}`);
    console.log(`      DEX: ${data.trade.dex}`);
    console.log(`      Value: $${Number(data.trade.valueUsd).toFixed(2)}`);
    console.log(`      P&L: $${Number(data.trade.profitLossUsd).toFixed(2)}`);
    console.log(`      Time: ${new Date(data.timestamp).toLocaleTimeString()}\n`);
  });

  socket.on('agent:stats_updated', (data) => {
    console.log('   📈 AGENT STATS UPDATED:');
    console.log(`      Agent: ${data.stats.username}`);
    console.log(`      Total Trades: ${data.stats.totalTrades}`);
    console.log(`      Total Volume: $${Number(data.stats.totalVolumeUsd).toFixed(2)}`);
    console.log(`      Total Profit: $${Number(data.stats.totalProfitUsd).toFixed(2)}`);
    console.log(`      Win Rate: ${Number(data.stats.winRate).toFixed(1)}%`);
    console.log(`      Time: ${new Date(data.timestamp).toLocaleTimeString()}\n`);
  });

  socket.on('leaderboard:updated', (data) => {
    console.log('   🏆 LEADERBOARD UPDATED:');
    console.log(`      Agent: ${data.stats.username}`);
    console.log(`      Rank changed due to stats update`);
    console.log(`      Time: ${new Date(data.timestamp).toLocaleTimeString()}\n`);
  });

  socket.on('indexer:started', (data) => {
    console.log('   🔄 INDEXER STARTED:');
    console.log(`      Scanning for new trades...`);
    console.log(`      Time: ${new Date(data.timestamp).toLocaleTimeString()}\n`);
  });

  socket.on('indexer:completed', (data) => {
    console.log('   ✅ INDEXER COMPLETED:');
    console.log(`      Agents scanned: ${data.total}`);
    console.log(`      Trades indexed: ${data.tradesIndexed || 0}`);
    console.log(`      Time: ${new Date(data.timestamp).toLocaleTimeString()}\n`);
  });

  // Keep connection alive
  console.log('   Waiting for events... (Press Ctrl+C to exit)\n');
  console.log('='.repeat(60));

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n   Disconnecting...');
    socket.disconnect();
    process.exit(0);
  });
}

// Run the test
testWebSocket().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
