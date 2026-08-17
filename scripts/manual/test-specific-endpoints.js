// test-specific-endpoints.js - Test specific endpoints
import 'dotenv/config';
import fetch from 'node-fetch';

const BASE_URL = process.env.WEBHOOK_URL || 'https://skulpt.onrender.com';
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

if (!VERIFY_TOKEN) {
  console.error("❌ Set WEBHOOK_VERIFY_TOKEN in your .env first.");
  process.exit(1);
}

console.log('🧪 Testing specific endpoints...\n');

async function testEndpoint(path, description) {
  try {
    console.log(`Testing ${description}...`);
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const content = await response.text();
      console.log(`Content: ${content.substring(0, 200)}...`);
      console.log('✅ Success!\n');
    } else {
      const errorText = await response.text();
      console.log(`Error: ${errorText}`);
      console.log('❌ Failed!\n');
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
    console.log('❌ Failed!\n');
  }
}

async function runTests() {
  await testEndpoint('/', 'Root endpoint');
  await testEndpoint('/health', 'Health endpoint');
  await testEndpoint(`/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=test123`, 'Webhook verification');
}

runTests();
