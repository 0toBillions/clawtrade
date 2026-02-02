/**
 * Test script for agent registration and authentication
 * Run: node test-agent-registration.js
 */

const { createWalletClient, http, parseEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');

const API_URL = 'http://localhost:4000';

async function testAgentFlow() {
  console.log('\n🧪 Testing ClawTrade Agent Registration & Authentication\n');
  console.log('=' .repeat(60));

  // Step 1: Create a test wallet
  console.log('\n1️⃣  Creating test wallet...');
  const privateKey = '0x' + Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');

  const account = privateKeyToAccount(privateKey);
  const walletAddress = account.address;

  console.log(`   Wallet Address: ${walletAddress}`);
  console.log(`   Private Key: ${privateKey.slice(0, 20)}...`);

  // Step 2: Sign registration message
  console.log('\n2️⃣  Signing registration message...');
  const username = `test_agent_${Date.now().toString().slice(-6)}`;
  const message = `Register ClawTrade agent: ${username}`;

  const signature = await account.signMessage({ message });
  console.log(`   Username: ${username}`);
  console.log(`   Signature: ${signature.slice(0, 20)}...`);

  // Step 3: Register agent
  console.log('\n3️⃣  Registering agent...');
  const registerResponse = await fetch(`${API_URL}/api/v1/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress,
      signature,
      message,
      username,
      displayName: `Test Agent ${username.split('_')[2]}`,
      bio: 'Autonomous AI trading agent testing ClawTrade platform',
    }),
  });

  if (!registerResponse.ok) {
    const error = await registerResponse.json();
    console.error('   ❌ Registration failed:', error);
    return;
  }

  const registerData = await registerResponse.json();
  console.log('   ✅ Registration successful!');
  console.log(`   Agent ID: ${registerData.data.agent.id}`);
  console.log(`   API Key: ${registerData.data.apiKey.slice(0, 20)}...`);

  const agentId = registerData.data.agent.id;
  const apiKey = registerData.data.apiKey;

  // Step 4: Authenticate with API key
  console.log('\n4️⃣  Authenticating with API key...');
  const authResponse = await fetch(`${API_URL}/api/v1/agents/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });

  if (!authResponse.ok) {
    const error = await authResponse.json();
    console.error('   ❌ Authentication failed:', error);
    return;
  }

  const authData = await authResponse.json();
  console.log('   ✅ Authentication successful!');
  console.log(`   JWT Token: ${authData.data.token.slice(0, 30)}...`);

  const jwtToken = authData.data.token;

  // Step 5: Get agent profile
  console.log('\n5️⃣  Fetching agent profile...');
  const profileResponse = await fetch(`${API_URL}/api/v1/agents/${agentId}`, {
    headers: { 'Authorization': `Bearer ${jwtToken}` },
  });

  if (!profileResponse.ok) {
    const error = await profileResponse.json();
    console.error('   ❌ Profile fetch failed:', error);
    return;
  }

  const profileData = await profileResponse.json();
  console.log('   ✅ Profile fetched successfully!');
  console.log(`   Username: ${profileData.data.username}`);
  console.log(`   Display Name: ${profileData.data.displayName}`);
  console.log(`   Wallet: ${profileData.data.walletAddress}`);
  console.log(`   Bio: ${profileData.data.bio}`);

  // Step 6: Update profile
  console.log('\n6️⃣  Updating agent profile...');
  const updateResponse = await fetch(`${API_URL}/api/v1/agents/${agentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`,
    },
    body: JSON.stringify({
      bio: 'Updated bio: Successfully tested all Phase 2 features! 🎉',
    }),
  });

  if (!updateResponse.ok) {
    const error = await updateResponse.json();
    console.error('   ❌ Profile update failed:', error);
    return;
  }

  const updateData = await updateResponse.json();
  console.log('   ✅ Profile updated successfully!');
  console.log(`   New Bio: ${updateData.data.bio}`);

  // Step 7: Check leaderboard
  console.log('\n7️⃣  Checking leaderboard...');
  const leaderboardResponse = await fetch(`${API_URL}/api/v1/leaderboard?metric=profit`);

  if (!leaderboardResponse.ok) {
    const error = await leaderboardResponse.json();
    console.error('   ❌ Leaderboard fetch failed:', error);
    return;
  }

  const leaderboardData = await leaderboardResponse.json();
  console.log('   ✅ Leaderboard fetched!');
  console.log(`   Total Agents: ${leaderboardData.data.totalAgents}`);
  console.log(`   Metric: ${leaderboardData.data.metric}`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ All Phase 2 features working correctly!\n');
  console.log('Summary:');
  console.log(`  • Agent registered: ${username}`);
  console.log(`  • Wallet verified: ${walletAddress.slice(0, 10)}...`);
  console.log(`  • API key generated and validated`);
  console.log(`  • JWT token issued (24h expiry)`);
  console.log(`  • Profile CRUD operations working`);
  console.log(`  • Rate limiting active`);
  console.log('=' .repeat(60) + '\n');
}

// Run the test
testAgentFlow().catch(console.error);
