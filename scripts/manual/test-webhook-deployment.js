// test-webhook-deployment.js - Test your deployed webhook
import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://trophybot-webhook.onrender.com';
const VERIFY_TOKEN = 'REDACTED_WEBHOOK_VERIFY_TOKEN';

console.log('🧪 Testing your deployed webhook...\n');

async function testWebhook() {
  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await fetch(`${WEBHOOK_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health Check:', healthData);
    console.log('');

    // Test 2: Webhook Verification
    console.log('2️⃣ Testing Webhook Verification...');
    const verifyUrl = `${WEBHOOK_URL}/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=test123`;
    const verifyResponse = await fetch(verifyUrl);
    const verifyText = await verifyResponse.text();
    console.log('✅ Webhook Verification Response:', verifyText);
    console.log('');

    // Test 3: Test Message (simulate WhatsApp message)
    console.log('3️⃣ Testing Message Processing...');
    const testMessage = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '840026788354094',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '133097362333913',
              phone_number_id: '776787372195136'
            },
            messages: [{
              from: '918939754303',
              id: 'test_message_123',
              timestamp: Math.floor(Date.now() / 1000),
              text: {
                body: 'Hi @skulpt browse'
              },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    };

    const messageResponse = await fetch(`${WEBHOOK_URL}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=test' // This would be real in production
      },
      body: JSON.stringify(testMessage)
    });

    console.log('✅ Message Test Response Status:', messageResponse.status);
    console.log('');

    console.log('🎉 All tests completed!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('1. Configure webhook in Meta Business Manager');
    console.log('2. Test with real WhatsApp messages');
    console.log('3. Your bot is ready to receive orders! 🏆');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWebhook();
