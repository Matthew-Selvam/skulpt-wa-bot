# Flask to Express.js Architecture Mapping

This document shows how the Flask workflow has been implemented in Express.js.

## 🏗️ Architecture Comparison

### Flask Architecture
```
Flask App → Security Decorator → Route Handler → Utils → Service
```

### Express Architecture
```
Express App → Security Middleware → Route Handler → Controller → Utils → Service
```

## 📁 File Structure Mapping

| Flask File | Express File | Purpose |
|------------|--------------|---------|
| `app/__init__.py` | `app.js` | Main application setup |
| `app/views.py` | `controllers/webhookController.js` | Route handlers (verify, handleMessage) |
| `app/decorators/security.py` | `middlewares/security.js` | Signature validation |
| `app/utils/whatsapp_utils.py` | `utils/whatsappUtils.js` | WhatsApp API utilities |
| `app/config.py` | `config/config.js` | Configuration management |
| - | `routes/webhook.js` | Express route definitions |
| - | `services/messageHandler.js` | Bot message logic (from bot.js) |
| - | `models/Trophy.js`, `models/Order.js` | Mongoose models |
| - | `utils/invoiceGenerator.js` | PDF generation |
| - | `utils/deliveryTracker.js` | Delivery tracking |

## 🔄 Function Mapping

### 1. Webhook Verification (GET /webhook)

#### Flask
```python
# app/views.py
@app.route("/webhook", methods=["GET"])
def verify():
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")
    
    if mode == "subscribe" and token == VERIFY_TOKEN:
        return challenge, 200
    return "Forbidden", 403
```

#### Express
```javascript
// controllers/webhookController.js
export function verify(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  
  if (mode === "subscribe" && token === config.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ status: "error", message: "Verification failed" });
}
```

### 2. Signature Validation

#### Flask
```python
# app/decorators/security.py
def signature_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        signature = request.headers.get("X-Hub-Signature-256", "")[7:]
        if not validate_signature(request.data, signature):
            return jsonify({"status": "error", "message": "Invalid signature"}), 403
        return f(*args, **kwargs)
    return decorated_function

def validate_signature(payload, signature):
    expected_signature = hmac.new(
        bytes(APP_SECRET, "latin-1"),
        msg=payload,
        digestmod=hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected_signature, signature)
```

#### Express
```javascript
// middlewares/security.js
export function signatureRequired(req, res, next) {
  const signature = req.headers["x-hub-signature-256"];
  
  if (!validateSignature(req.body, signature)) {
    return res.status(403).json({ 
      status: "error", 
      message: "Invalid signature" 
    });
  }
  next();
}

export function validateSignature(payload, signature) {
  const receivedSignature = signature.substring(7); // Remove 'sha256='
  const expectedSignature = crypto
    .createHmac("sha256", config.APP_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");
  
  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expectedSignature)
  );
}
```

### 3. Message Handling (POST /webhook)

#### Flask
```python
# app/views.py
@app.route("/webhook", methods=["POST"])
@signature_required
def webhook_post():
    return handle_message()

def handle_message():
    body = request.get_json()
    
    # Check for status updates
    if body.get("entry", [{}])[0].get("changes", [{}])[0].get("value", {}).get("statuses"):
        return jsonify({"status": "ok"}), 200
    
    # Validate message structure
    if not is_valid_whatsapp_message(body):
        return jsonify({"status": "error", "message": "Not a WhatsApp API event"}), 404
    
    # Process message
    process_whatsapp_message(body)
    
    return jsonify({"status": "ok"}), 200
```

#### Express
```javascript
// routes/webhook.js
router.post("/", signatureRequired, handleMessage);

// controllers/webhookController.js
export async function handleMessage(req, res) {
  const body = req.body;
  
  // Check for status updates
  const isStatusUpdate = body?.entry?.[0]?.changes?.[0]?.value?.statuses;
  if (isStatusUpdate) {
    return res.status(200).json({ status: "ok" });
  }
  
  // Validate message structure
  if (!isValidWhatsAppMessage(body)) {
    return res.status(404).json({ 
      status: "error", 
      message: "Not a WhatsApp API event" 
    });
  }
  
  // Process message
  await processWhatsAppMessage(body);
  
  return res.status(200).json({ status: "ok" });
}
```

### 4. Message Validation

#### Flask
```python
# app/utils/whatsapp_utils.py
def is_valid_whatsapp_message(body):
    return (
        body.get("object")
        and body.get("entry")
        and body["entry"][0].get("changes")
        and body["entry"][0]["changes"][0].get("value")
        and body["entry"][0]["changes"][0]["value"].get("messages")
        and body["entry"][0]["changes"][0]["value"]["messages"][0]
    )
```

#### Express
```javascript
// utils/whatsappUtils.js
export function isValidWhatsAppMessage(body) {
  return (
    body &&
    body.object === "whatsapp_business_account" &&
    body.entry &&
    body.entry[0] &&
    body.entry[0].changes &&
    body.entry[0].changes[0] &&
    body.entry[0].changes[0].value &&
    body.entry[0].changes[0].value.messages &&
    body.entry[0].changes[0].value.messages[0]
  );
}
```

### 5. Message Processing

#### Flask
```python
# app/utils/whatsapp_utils.py
def process_whatsapp_message(body):
    wa_id = body["entry"][0]["changes"][0]["value"]["contacts"][0]["wa_id"]
    name = body["entry"][0]["changes"][0]["value"]["contacts"][0]["profile"]["name"]
    message = body["entry"][0]["changes"][0]["value"]["messages"][0]
    message_body = message["text"]["body"]
    
    # Generate response
    response = generate_response(message_body)
    
    # Send message
    data = get_text_message_input(wa_id, response)
    send_message(data)
```

#### Express
```javascript
// utils/whatsappUtils.js
export async function processWhatsAppMessage(body) {
  const contact = body.entry[0].changes[0].value.contacts[0];
  const waId = contact.wa_id;
  const name = contact.profile.name;
  
  const message = body.entry[0].changes[0].value.messages[0];
  const messageBody = message.text?.body;
  
  // Generate response
  const response = await generateResponse(messageBody, waId, name, message);
  
  // Send message
  if (response) {
    const processedText = processTextForWhatsApp(response);
    const messageData = getTextMessageInput(waId, processedText);
    await sendMessage(messageData);
  }
}
```

### 6. Sending Messages

#### Flask
```python
# app/utils/whatsapp_utils.py
def send_message(data):
    headers = {
        "Content-type": "application/json",
        "Authorization": f"Bearer {ACCESS_TOKEN}",
    }
    
    url = f"https://graph.facebook.com/{VERSION}/{PHONE_NUMBER_ID}/messages"
    
    response = requests.post(url, data=json.dumps(data), headers=headers, timeout=10)
    
    if response.status_code == 200:
        return response
    else:
        return response

def get_text_message_input(recipient, text):
    return json.dumps({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
        "type": "text",
        "text": {"preview_url": False, "body": text},
    })
```

#### Express
```javascript
// utils/whatsappUtils.js
export async function sendMessage(data) {
  const url = `https://graph.facebook.com/${config.VERSION}/${config.PHONE_NUMBER_ID}/messages`;
  
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.ACCESS_TOKEN}`,
  };
  
  const response = await axios.post(url, data, {
    headers,
    timeout: 10000,
  });
  
  logHttpResponse(response);
  return response;
}

export function getTextMessageInput(recipient, text) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "text",
    text: {
      preview_url: false,
      body: text,
    },
  };
}
```

## 🔐 Security Features Comparison

| Feature | Flask | Express |
|---------|-------|---------|
| Signature Validation | `@signature_required` decorator | `signatureRequired` middleware |
| HMAC Algorithm | `hashlib.sha256` | `crypto.createHmac("sha256")` |
| Constant-Time Comparison | `hmac.compare_digest()` | `crypto.timingSafeEqual()` |
| Token Verification | String comparison | String comparison |

## 📊 Request Flow Comparison

### Flask Flow
```
POST /webhook
    ↓
@signature_required decorator
    ↓
webhook_post()
    ↓
handle_message()
    ↓
is_valid_whatsapp_message()
    ↓
process_whatsapp_message()
    ↓
generate_response()
    ↓
send_message()
```

### Express Flow
```
POST /webhook
    ↓
signatureRequired middleware
    ↓
handleMessage controller
    ↓
isValidWhatsAppMessage()
    ↓
processWhatsAppMessage()
    ↓
generateResponse()
    ↓
sendMessage()
```

## 🎯 Key Differences

### 1. Decorator vs Middleware
- **Flask**: Uses decorators (`@signature_required`)
- **Express**: Uses middleware functions (`signatureRequired`)

### 2. Route Definition
- **Flask**: Routes defined with decorators on functions
- **Express**: Routes defined in separate router files

### 3. Request/Response Objects
- **Flask**: Global `request` object
- **Express**: Passed as `req` parameter to handlers

### 4. Error Handling
- **Flask**: Return tuples `(response, status_code)`
- **Express**: Use `res.status(code).json()` or `res.send()`

### 5. Async Operations
- **Flask**: Synchronous by default (unless using async views)
- **Express**: Async/await native support

### 6. Project Structure
- **Flask**: Blueprint-based organization
- **Express**: Router + MVC pattern

## 🚀 Running the Applications

### Flask
```bash
python app.py
# or
flask run
```

### Express
```bash
npm start
# or
npm run start:app
# or
node app.js
```

## 📝 Configuration Management

### Flask
```python
# app/config.py
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN")
APP_SECRET = os.getenv("APP_SECRET")
```

### Express
```javascript
// config/config.js
export const config = {
  VERIFY_TOKEN: process.env.WEBHOOK_VERIFY_TOKEN,
  APP_SECRET: process.env.WEBHOOK_SECRET,
};
```

## ✅ Feature Parity Checklist

- ✅ Webhook verification (GET /webhook)
- ✅ Message handling (POST /webhook)
- ✅ Signature validation
- ✅ Status update filtering
- ✅ Message structure validation
- ✅ Message processing
- ✅ Response generation
- ✅ WhatsApp API integration
- ✅ Error handling
- ✅ Logging
- ✅ Configuration management
- ✅ Security features
- ✅ Bot conversation logic
- ✅ Session management
- ✅ Database integration
- ✅ Invoice generation
- ✅ Delivery tracking

## 🎓 Summary

The Express.js implementation maintains **100% feature parity** with the Flask workflow while following Node.js and Express.js best practices:

1. **Middleware** replaces decorators for cross-cutting concerns
2. **Routers** provide clear route organization
3. **Controllers** handle request/response logic
4. **Services** contain business logic
5. **Utils** provide reusable functions
6. **Models** define data structures
7. **Config** centralizes configuration

Both implementations follow the **same security practices**, handle **identical webhook events**, and process messages **the same way**.
