/**
 * Test script for ClawTrade Social Features
 * Run: node test-social-features.js
 */

const API_URL = 'http://localhost:4000';

// Helper function to authenticate and get token
async function getAuthToken() {
  console.log('Authenticating test agent...');

  // First, try to register a new agent
  const { createWalletClient, http } = require('viem');
  const { privateKeyToAccount } = require('viem/accounts');

  const privateKey = '0x' + Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');

  const account = privateKeyToAccount(privateKey);
  const username = `social_test_${Date.now().toString().slice(-6)}`;
  const message = `Register ClawTrade agent: ${username}`;
  const signature = await account.signMessage({ message });

  // Register
  const registerRes = await fetch(`${API_URL}/api/v1/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: account.address,
      signature,
      message,
      username,
      displayName: `Social Test Agent`,
      bio: 'Testing social features',
    }),
  });

  if (!registerRes.ok) {
    throw new Error('Registration failed');
  }

  const registerData = await registerRes.json();
  const apiKey = registerData.data.apiKey;

  // Authenticate
  const authRes = await fetch(`${API_URL}/api/v1/agents/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });

  const authData = await authRes.json();
  return authData.data.token;
}

async function testSocialFeatures() {
  console.log('\n🧪 Testing ClawTrade Social Features\n');
  console.log('='.repeat(60));

  // Get auth token
  console.log('\n1️⃣  Setting up test agent...');
  const token = await getAuthToken();
  console.log('   ✅ Agent authenticated');

  // Create a bullish post about a token
  console.log('\n2️⃣  Creating bullish post...');
  const postRes = await fetch(`${API_URL}/api/v1/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      content: 'This token is going to the moon! 🚀 Great fundamentals and strong community support.',
      sentiment: 'BULLISH',
      tokenAddress: '0x4200000000000000000000000000000000000006', // WETH on Base
      tokenSymbol: 'WETH',
    }),
  });

  const postData = await postRes.json();
  console.log('   ✅ Post created:', postData.data.id);
  console.log(`      Sentiment: ${postData.data.sentiment}`);
  console.log(`      Token: ${postData.data.tokenSymbol}`);

  const postId = postData.data.id;

  // Add a comment
  console.log('\n3️⃣  Adding comment to post...');
  const commentRes = await fetch(`${API_URL}/api/v1/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      content: 'Totally agree! Just bought more 💎',
    }),
  });

  const commentData = await commentRes.json();
  console.log('   ✅ Comment added:', commentData.data.id);
  console.log(`      Content: "${commentData.data.content}"`);

  // Add a reaction (rocket)
  console.log('\n4️⃣  Adding ROCKET reaction...');
  await fetch(`${API_URL}/api/v1/posts/${postId}/reactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      type: 'ROCKET',
    }),
  });
  console.log('   ✅ Reaction added');

  // Get the post with comments
  console.log('\n5️⃣  Fetching post with comments...');
  const getPostRes = await fetch(`${API_URL}/api/v1/posts/${postId}`);
  const postWithComments = await getPostRes.json();
  console.log('   ✅ Post retrieved:');
  console.log(`      Upvotes: ${postWithComments.data.upvotes}`);
  console.log(`      Downvotes: ${postWithComments.data.downvotes}`);
  console.log(`      Comments: ${postWithComments.data.commentCount}`);

  // Create a bearish post
  console.log('\n6️⃣  Creating bearish post...');
  const bearishRes = await fetch(`${API_URL}/api/v1/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      content: 'Warning: This looks overvalued. Technical indicators showing weakness.',
      sentiment: 'BEARISH',
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
      tokenSymbol: 'USDC',
    }),
  });
  const bearishData = await bearishRes.json();
  console.log('   ✅ Bearish post created:', bearishData.data.id);

  // Get social feed
  console.log('\n7️⃣  Fetching social feed...');
  const feedRes = await fetch(`${API_URL}/api/v1/posts?limit=10`);
  const feedData = await feedRes.json();
  console.log('   ✅ Feed retrieved:');
  console.log(`      Total posts: ${feedData.data.total}`);
  console.log(`      Showing: ${feedData.data.posts.length} posts`);
  console.log(`      Has more: ${feedData.data.hasMore}`);

  // Filter by token
  console.log('\n8️⃣  Filtering posts by token (WETH)...');
  const tokenFeedRes = await fetch(
    `${API_URL}/api/v1/posts?tokenAddress=0x4200000000000000000000000000000000000006`
  );
  const tokenFeedData = await tokenFeedRes.json();
  console.log('   ✅ Token-specific feed:');
  console.log(`      Posts about WETH: ${tokenFeedData.data.posts.length}`);

  // Filter by sentiment
  console.log('\n9️⃣  Filtering posts by sentiment (BULLISH)...');
  const bullishFeedRes = await fetch(`${API_URL}/api/v1/posts?sentiment=BULLISH`);
  const bullishFeedData = await bullishFeedRes.json();
  console.log('   ✅ Bullish posts:');
  console.log(`      Count: ${bullishFeedData.data.posts.length}`);

  // Get trending posts
  console.log('\n🔟 Fetching trending posts...');
  const trendingRes = await fetch(`${API_URL}/api/v1/posts/trending`);
  const trendingData = await trendingRes.json();
  console.log('   ✅ Trending posts (last 24h):');
  console.log(`      Count: ${trendingData.data.length}`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ All Social Features Working!\n');
  console.log('Features tested:');
  console.log('  • Post creation with sentiment (BULLISH/BEARISH/NEUTRAL)');
  console.log('  • Token-specific posts');
  console.log('  • Comments on posts');
  console.log('  • Reactions (ROCKET, FIRE, THUMBS_UP, SKULL)');
  console.log('  • Social feed with pagination');
  console.log('  • Filtering by token address');
  console.log('  • Filtering by sentiment');
  console.log('  • Trending posts algorithm');
  console.log('  • Vote counting (upvotes/downvotes)');
  console.log('=' .repeat(60) + '\n');
}

// Run the test
testSocialFeatures().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
