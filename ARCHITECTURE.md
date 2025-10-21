# Architecture Diagram

## 📊 Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          WHATSAPP USER                                  │
│                    (Sends "hi" via WhatsApp)                           │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    WHATSAPP CLOUD API                                   │
│              (Meta's WhatsApp Business Platform)                        │
│                                                                         │
│  • Receives user message                                               │
│  • Packages into webhook payload                                       │
│  • Signs with HMAC-SHA256                                              │
│  • Sends POST request                                                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ POST /webhook
                                 │ Headers: X-Hub-Signature-256
                                 │ Body: {entry: [...], object: "..."}
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXPRESS SERVER                                  │
│                           (app.js)                                      │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                      MIDDLEWARE LAYER                            │ │
│  │                                                                  │ │
│  │  1. express.json() - Parse JSON body                            │ │
│  │  2. Logging middleware - Log request                            │ │
│  │  3. signatureRequired - Validate HMAC signature ✅              │ │
│  │     └─ crypto.timingSafeEqual()                                 │ │
│  │     └─ crypto.createHmac("sha256")                              │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                 │                                       │
│                                 ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                        ROUTE LAYER                               │ │
│  │                   (routes/webhook.js)                            │ │
│  │                                                                  │ │
│  │  • GET  /webhook  → verify()                                    │ │
│  │  • POST /webhook  → handleMessage()                             │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                 │                                       │
│                                 ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                    CONTROLLER LAYER                              │ │
│  │              (controllers/webhookController.js)                  │ │
│  │                                                                  │ │
│  │  handleMessage() {                                               │ │
│  │    1. Check if status update → Return 200                       │ │
│  │    2. Validate message structure                                │ │
│  │    3. Call processWhatsAppMessage()                             │ │
│  │    4. Return {"status": "ok"}                                   │ │
│  │  }                                                               │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         UTILS LAYER                                     │
│                  (utils/whatsappUtils.js)                              │
│                                                                         │
│  processWhatsAppMessage() {                                            │
│    1. Extract: wa_id, name, message_body                               │
│    2. Call generateResponse() from service layer                       │
│    3. Format response with processTextForWhatsApp()                    │
│    4. Send via sendMessage()                                           │
│  }                                                                     │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                                     │
│                 (services/messageHandler.js)                           │
│                                                                         │
│  generateResponse() {                                                  │
│    1. Get/Create session for user                                     │
│    2. Parse message intent (greeting, browse, etc.)                   │
│    3. Handle conversation flow:                                       │
│       • welcome → browse                                              │
│       • browse → select item                                          │
│       • customization → checkout                                      │
│       • checkout → payment                                            │
│       • payment → invoice + delivery                                  │
│    4. Return response text                                            │
│  }                                                                     │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
┌───────────────────────────────┐  ┌──────────────────────────────────┐
│      DATABASE LAYER           │  │      EXTERNAL SERVICES           │
│     (MongoDB/Mongoose)        │  │                                  │
│                               │  │  • Invoice Generator (PDFKit)    │
│  • Trophy Model               │  │  • Delivery Tracker              │
│  • Order Model                │  │  • WhatsApp API Client           │
│  • Session Storage (Map)      │  │                                  │
└───────────────────────────────┘  └──────────────────────────────────┘
                    │                         │
                    └────────────┬────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    RESPONSE BACK TO USER                                │
│                                                                         │
│  1. sendMessage() calls WhatsApp Graph API                             │
│  2. POST to graph.facebook.com/{version}/{phone_id}/messages          │
│  3. User receives response on WhatsApp                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Detailed Request Flow

### 1. GET /webhook (Verification)

```
Meta Developer Console
        │
        │ GET /webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
        │
        ▼
Express Server: GET /webhook
        │
        ▼
routes/webhook.js
        │
        ▼
webhookController.verify()
        │
        ├─ Extract query params
        ├─ Validate hub.mode === "subscribe"
        ├─ Validate hub.verify_token === VERIFY_TOKEN
        │
        └─ Return hub.challenge (200) ✅
           OR
           Return "Verification failed" (403) ❌
```

### 2. POST /webhook (Message Handling)

```
WhatsApp User sends "browse"
        │
        ▼
WhatsApp Cloud API
        │
        ├─ Create payload: {object, entry: [{changes: [...]}]}
        ├─ Sign with HMAC-SHA256
        │
        ▼
Express Server: POST /webhook
        │
        ▼
Middleware: signatureRequired
        │
        ├─ Extract X-Hub-Signature-256 header
        ├─ Compute HMAC-SHA256 of body
        ├─ Compare signatures with crypto.timingSafeEqual()
        │
        ├─ Valid? Continue ✅
        └─ Invalid? Return 403 ❌
        │
        ▼
webhookController.handleMessage()
        │
        ├─ Check: Is this a status update?
        │   └─ Yes? Return 200 (skip processing)
        │
        ├─ Validate: isValidWhatsAppMessage(body)?
        │   └─ No? Return 404
        │
        ▼
whatsappUtils.processWhatsAppMessage()
        │
        ├─ Extract: wa_id, name, message_body
        │
        ▼
messageHandler.generateResponse()
        │
        ├─ Get session for user (Map or DB)
        ├─ Parse message: "browse"
        ├─ Check current step: "welcome"
        ├─ Query database: Trophy.find()
        ├─ Format response: "🏆 Available Trophies:\n1. Golden Trophy..."
        ├─ Update session: step = "browse"
        │
        └─ Return response text
        │
        ▼
whatsappUtils.processTextForWhatsApp()
        │
        ├─ Remove Chinese brackets
        ├─ Convert ** to * (WhatsApp bold)
        │
        ▼
whatsappUtils.sendMessage()
        │
        ├─ Format: getTextMessageInput(wa_id, text)
        ├─ POST to: graph.facebook.com/v18.0/{PHONE_ID}/messages
        ├─ Headers: Authorization: Bearer {ACCESS_TOKEN}
        │
        ▼
WhatsApp Cloud API
        │
        ▼
User receives message on WhatsApp ✅
```

## 🔐 Security Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SIGNATURE VALIDATION                            │
└─────────────────────────────────────────────────────────────────────┘

1. WhatsApp computes signature:
   ┌─────────────────────────────────────────────────────┐
   │ signature = HMAC-SHA256(APP_SECRET, request_body)   │
   └─────────────────────────────────────────────────────┘

2. WhatsApp sends:
   ┌─────────────────────────────────────────────────────┐
   │ Header: X-Hub-Signature-256: sha256=<signature>     │
   │ Body: {JSON payload}                                │
   └─────────────────────────────────────────────────────┘

3. Our server validates:
   ┌─────────────────────────────────────────────────────┐
   │ receivedSignature = header.substring(7)             │
   │ expectedSignature = HMAC-SHA256(APP_SECRET, body)   │
   │ isValid = crypto.timingSafeEqual(received, expected)│
   └─────────────────────────────────────────────────────┘

4. Result:
   ├─ Valid? Continue processing ✅
   └─ Invalid? Return 403 Forbidden ❌
```

## 💾 Session Management

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SESSION LIFECYCLE                               │
└─────────────────────────────────────────────────────────────────────┘

User first message:
        │
        ▼
    Check Map: sessions.has(wa_id)?
        │
        ├─ No: Create new session
        │      {
        │        step: "welcome",
        │        cart: [],
        │        customization: "",
        │        userId: wa_id
        │      }
        │
        └─ Yes: Get existing session
        │
        ▼
    Process message based on session.step:
        │
        ├─ step: "welcome" → Show welcome/browse
        ├─ step: "browse" → Handle item selection
        ├─ step: "customization" → Save customization
        ├─ step: "checkout" → Show summary
        ├─ step: "payment" → Process payment
        └─ step: "done" → Order complete
        
    Update session after processing
        │
        ▼
    sessions.set(wa_id, updatedSession)
```

## 📊 Database Interactions

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DATABASE OPERATIONS                             │
└─────────────────────────────────────────────────────────────────────┘

Trophy Collection:
    ┌─────────────────────────────────────┐
    │ • find() - Browse trophies          │
    │ • findOne() - Get specific trophy   │
    │ • insertMany() - Seed sample data   │
    └─────────────────────────────────────┘

Order Collection:
    ┌─────────────────────────────────────┐
    │ • new Order() - Create order        │
    │ • save() - Save to database         │
    │ • findById() - Get order details    │
    │ • update() - Update order status    │
    └─────────────────────────────────────┘

Flow:
    Browse → Trophy.find()
    Select → Save to session.cart
    Checkout → new Order({...})
    Pay → order.save() + Invoice
```

## 🎯 Complete User Journey

```
USER                    BOT                     DATABASE            EXTERNAL
  │                      │                          │                  │
  ├─ "hi" ──────────────►│                          │                  │
  │                      ├─ Get session             │                  │
  │◄─ Welcome message ───┤                          │                  │
  │                      │                          │                  │
  ├─ "browse" ──────────►│                          │                  │
  │                      ├─ Trophy.find() ─────────►│                  │
  │                      │◄─ Return trophies ───────┤                  │
  │◄─ Trophy list ───────┤                          │                  │
  │                      │                          │                  │
  ├─ "1" ────────────────►│                          │                  │
  │                      ├─ Add to cart             │                  │
  │◄─ Customization? ────┤                          │                  │
  │                      │                          │                  │
  ├─ "Best Employee" ───►│                          │                  │
  │                      ├─ Save customization      │                  │
  │◄─ Checkout? ─────────┤                          │                  │
  │                      │                          │                  │
  ├─ "checkout" ────────►│                          │                  │
  │                      ├─ Show summary            │                  │
  │◄─ Order summary ─────┤                          │                  │
  │                      │                          │                  │
  ├─ "pay" ──────────────►│                          │                  │
  │                      ├─ new Order() ───────────►│                  │
  │                      ├─ order.save() ──────────►│                  │
  │                      ├─ generateInvoice() ──────┼─────────────────►│
  │                      │                          │            PDFKit │
  │◄─ Confirmation ──────┤                          │                  │
  │◄─ Invoice ───────────┤◄─────────────────────────┼──────────────────┤
  │                      │                          │                  │
  │◄─ "Packed" ──────────┤ (after 10s)              │                  │
  │◄─ "Assigned" ────────┤ (after 20s)              │                  │
  │◄─ "Picked up" ───────┤ (after 30s)              │                  │
  │◄─ "Near you" ────────┤ (after 40s)              │                  │
  │◄─ "Delivered" ───────┤ (after 50s)              │                  │
```

---

**This architecture ensures:**
- ✅ Secure webhook handling
- ✅ Scalable message processing
- ✅ Clean separation of concerns
- ✅ Easy to test and maintain
- ✅ Production-ready design
