// monitor-bot.js - Monitor bot activity
import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://skulpt.onrender.com/webhook';
const HEALTH_URL = 'https://skulpt.onrender.com/health';

console.log('🤖 TrophyBot Monitor Started');
console.log('📡 Webhook URL:', WEBHOOK_URL);
console.log('💚 Health URL:', HEALTH_URL);
console.log('⏰ Monitoring started at:', new Date().toISOString());
console.log('');

console.log('📋 Test Commands:');
console.log('1. Send "Hi" to +91 88389 75981');
console.log('2. Send "browse" to see trophies');
console.log('3. Send "help" for commands');
console.log('4. Try the full order flow: browse → select → customize → checkout → pay');
console.log('');

console.log('🔄 Monitoring webhook for incoming messages...');
console.log('Press Ctrl+C to stop monitoring');
console.log('');

// Monitor health every 30 seconds
setInterval(async () => {
  try {
    const response = await fetch(HEALTH_URL);
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ [${new Date().toLocaleTimeString()}] Bot is healthy - ${data.timestamp}`);
    } else {
      console.log(`❌ [${new Date().toLocaleTimeString()}] Bot health check failed`);
    }
  } catch (error) {
    console.log(`❌ [${new Date().toLocaleTimeString()}] Health check error: ${error.message}`);
  }
}, 30000);

// Keep the script running
process.on('SIGINT', () => {
  console.log('\n👋 Monitoring stopped');
  process.exit(0);
});
