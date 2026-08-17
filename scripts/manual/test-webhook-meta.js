// test-webhook-meta.js - Test webhook with Meta's test endpoint
import 'dotenv/config';
import fetch from 'node-fetch';

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://skulpt.onrender.com/webhook';
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

if (!VERIFY_TOKEN) {
  console.error("❌ Set WEBHOOK_VERIFY_TOKEN in your .env first.");
  process.exit(1);
}

console.log('🧪 Testing Meta Webhook Integration...\n');

async function testWebhook() {
  try {
    // Test 1: Webhook verification (GET)
    console.log('1️⃣ Testing webhook verification...');
    const verifyUrl = `${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=test123`;
    
    const verifyResponse = await fetch(verifyUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (verifyResponse.ok) {
      const verifyText = await verifyResponse.text();
      console.log('✅ Webhook verification successful:', verifyText);
    } else {
      console.log('❌ Webhook verification failed:', verifyResponse.status);
      const errorText = await verifyResponse.text();
      console.log('Error:', errorText);
    }
    console.log('');

    // Test 2: Simulate Meta's test message (POST)
    console.log('2️⃣ Simulating Meta test message...');
    const testMessage = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '840026788354094',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '918838975981',
              phone_number_id: '776787372195136'
            },
            messages: [{
              from: '919999999999',
              id: 'test_message_123',
              timestamp: Math.floor(Date.now() / 1000),
              text: {
                body: 'Test message from Meta'
              },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    };

    const messageResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(testMessage)
    });

    console.log('✅ Test message sent, status:', messageResponse.status);
    const responseText = await messageResponse.text();
    console.log('Response:', responseText);
    console.log('');

    console.log('🎯 Next Steps:');
    console.log('1. Go to Meta Business Manager → WhatsApp → Configuration → Webhook');
    console.log('2. Scroll down to "messages" field');
    console.log('3. Click "Test" button next to messages');
    console.log('4. Check Render logs for "Webhook received" messages');
    console.log('5. If you see webhook messages, your bot should work!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWebhook();
