// routes/webhook.js - Webhook routes (Flask-like structure)
import express from "express";
import { verify, handleMessage } from "../controllers/webhookController.js";
import { signatureRequired } from "../middlewares/security.js";

const router = express.Router();

// GET /webhook - Webhook verification (like Flask's verify() function)
router.get("/", verify);

// POST /webhook - Message handling (like Flask's webhook_post() with @signature_required)
router.post("/", signatureRequired, handleMessage);

export default router;
