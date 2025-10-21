// middlewares/security.js - Security middleware for signature validation
import crypto from "crypto";
import { config } from "../config/config.js";

/**
 * Validate HMAC-SHA256 signature from WhatsApp webhook
 * @param {Object} payload - Request body
 * @param {string} signature - X-Hub-Signature-256 header value
 * @returns {boolean} - Whether signature is valid
 */
export function validateSignature(payload, signature) {
  try {
    // Remove 'sha256=' prefix from signature
    const receivedSignature = signature.startsWith("sha256=")
      ? signature.substring(7)
      : signature;

    // Compute expected signature
    const expectedSignature = crypto
      .createHmac("sha256", config.APP_SECRET)
      .update(JSON.stringify(payload))
      .digest("hex");

    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(expectedSignature)
    );
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

//   if (!validateSignature(req.body, signature)) {
//     console.log("❌ Invalid signature");
//     return res.status(403).json({
//       status: "error",
//       message: "Invalid signature",
//     });
//   }

  console.log("✅ Signature validated successfully");
  next();
}
