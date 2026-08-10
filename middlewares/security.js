// middlewares/security.js - Security middleware for signature validation
import crypto from "crypto";
import { config } from "../config/config.js";

/**
 * Validate HMAC-SHA256 signature from WhatsApp webhook
 * @param {Buffer|string} rawBody - Raw request body exactly as received
 * @param {string} signature - X-Hub-Signature-256 header value
 * @returns {boolean} - Whether signature is valid
 */
export function validateSignature(rawBody, signature) {
  try {
    // Remove 'sha256=' prefix from signature
    const receivedSignature = signature.startsWith("sha256=")
      ? signature.substring(7)
      : signature;

    // Compute over the raw bytes Meta signed — JSON.stringify of the parsed
    // body does not reproduce the original payload (key order, whitespace,
    // unicode escaping all differ), so hashing it would never match.
    const expectedSignature = crypto
      .createHmac("sha256", config.APP_SECRET)
      .update(rawBody)
      .digest("hex");

    const receivedBuf = Buffer.from(receivedSignature, "hex");
    const expectedBuf = Buffer.from(expectedSignature, "hex");

    // timingSafeEqual throws on length mismatch, so check that first
    if (receivedBuf.length !== expectedBuf.length) return false;

    return crypto.timingSafeEqual(receivedBuf, expectedBuf);
  } catch (error) {
    console.error("❌ Signature validation error:", error);
    return false;
  }
}

/**
 * Express middleware to validate webhook signature
 */
export function signatureRequired(req, res, next) {
  const signature = req.headers["x-hub-signature-256"];

  if (!signature) {
    console.log("⚠️ No signature provided in request");
    return res.status(403).json({
      status: "error",
      message: "Missing signature",
    });
  }

  const rawBody =
    req.rawBody || Buffer.from(JSON.stringify(req.body || {}), "utf8");

  if (!validateSignature(rawBody, signature)) {
    console.log("❌ Invalid signature");
    return res.status(403).json({
      status: "error",
      message: "Invalid signature",
    });
  }

  console.log("✅ Signature validated successfully");
  next();
}
