// test-webhook-simple.js - Simple webhook test
import 'dotenv/config';
import fetch from 'node-fetch';

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://trophybot-webhook.onrender.com';
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

if (!VERIFY_TOKEN) {
  console.error("❌ Set WEBHOOK_VERIFY_TOKEN in your .env first.");
  process.exit(1);
}

console.log('🧪 Testing webhook endpoints...\n');

async function testEndpoints() {
  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    try {
      const healthResponse = await fetch(`${WEBHOOK_URL}/health`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log('✅ Health Check Success:', healthData);
      } else {
        console.log('❌ Health Check Failed:', healthResponse.status, healthResponse.statusText);
        const errorText = await healthResponse.text();
        console.log('Error Response:', errorText);
      }
    } catch (error) {
      console.log('❌ Health Check Error:', error.message);
    }
    console.log('');

    // Test 2: Webhook Verification
    console.log('2️⃣ Testing Webhook Verification...');
    try {
      const verifyUrl = `${WEBHOOK_URL}/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=test123`;
      const verifyResponse = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (verifyResponse.ok) {
        const verifyText = await verifyResponse.text();
        console.log('✅ Webhook Verification Success:', verifyText);
      } else {
        console.log('❌ Webhook Verification Failed:', verifyResponse.status, verifyResponse.statusText);
        const errorText = await verifyResponse.text();
        console.log('Error Response:', errorText);
      }
    } catch (error) {
      console.log('❌ Webhook Verification Error:', error.message);
    }
    console.log('');

    // Test 3: Root endpoint
    console.log('3️⃣ Testing Root Endpoint...');
    try {
      const rootResponse = await fetch(WEBHOOK_URL, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      console.log('Root Response Status:', rootResponse.status);
      const rootText = await rootResponse.text();
      console.log('Root Response:', rootText.substring(0, 200));
    } catch (error) {
      console.log('❌ Root Endpoint Error:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEndpoints();
