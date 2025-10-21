// utils/whatsappUtils.js - WhatsApp utility functions (Flask whatsapp_utils.py equivalent)
import axios from "axios";
import { config } from "../config/config.js";
import { generateResponse } from "../services/messageHandler.js";

/**
 * Log HTTP response for debugging
 * Equivalent to log_http_response() in Flask
 */
export function logHttpResponse(response) {
  console.log("📡 HTTP Response:", {
    status: response.status,
    statusText: response.statusText,
    data: response.data,
  });
}

/**
 * Format text message input for WhatsApp API
 * Equivalent to get_text_message_input() in Flask
 */
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

/**
 * Format document message input for WhatsApp API (using media ID)
 * Used for sending PDF invoices
 */
export function getDocumentMessageInput(recipient, mediaId, filename, caption) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "document",
    document: {
      id: mediaId,
      filename: filename,
      caption: caption || "",
    },
  };
}

/**
 * Upload media file to WhatsApp Cloud API
 * @param {string} filePath - Local file path
 * @param {string} mimeType - MIME type (e.g., 'application/pdf')
 * @returns {Promise<string>} - Media ID
 */
export async function uploadMedia(filePath, mimeType = "application/pdf") {
  try {
    const fs = await import("fs");
    const FormData = await import("form-data");
    
    const url = `https://graph.facebook.com/${config.VERSION}/${config.PHONE_NUMBER_ID}/media`;
    
    const formData = new FormData.default();
    formData.append("messaging_product", "whatsapp");
    formData.append("file", fs.default.createReadStream(filePath), {
      contentType: mimeType,
    });

    console.log("📤 Uploading media to WhatsApp API:", {
      url,
      filePath,
      mimeType,
    });

    const response = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${config.ACCESS_TOKEN}`,
      },
      timeout: 30000, // 30 second timeout for file upload
    });

    console.log("✅ Media uploaded successfully:", response.data);
    return response.data.id; // Return media ID

  } catch (error) {
    console.error("❌ Failed to upload media:", error.response?.data || error.message);
    throw new Error("Failed to upload media");
  }
}

/**
 * Send PDF document via WhatsApp
 * @param {string} recipient - Recipient phone number
 * @param {string} filePath - Local file path
 * @param {string} filename - Display filename
 * @param {string} caption - Optional caption
 */
export async function sendDocument(recipient, filePath, filename, caption) {
  try {
    // First, upload the file to WhatsApp
    const mediaId = await uploadMedia(filePath, "application/pdf");
    
    // Then, send the document using the media ID
    const messageData = getDocumentMessageInput(recipient, mediaId, filename, caption);
    await sendMessage(messageData);
    
    console.log("✅ Document sent successfully");
  } catch (error) {
    console.error("❌ Failed to send document:", error.message);
    throw error;
  }
}

/**
 * Split long text into chunks that fit WhatsApp's 4096 character limit
 * @param {string} text - Text to split
 * @param {number} maxLength - Maximum length per chunk (default 4000 to be safe)
 * @returns {string[]} - Array of text chunks
 */
export function splitLongMessage(text, maxLength = 4000) {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  let currentChunk = "";
  const lines = text.split("\n");

  for (const line of lines) {
    // If adding this line would exceed the limit
    if ((currentChunk + line + "\n").length > maxLength) {
      // If current chunk has content, push it
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }

      // If single line is too long, split it by words
      if (line.length > maxLength) {
        const words = line.split(" ");
        for (const word of words) {
          if ((currentChunk + word + " ").length > maxLength) {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
              currentChunk = "";
            }
            currentChunk = word + " ";
          } else {
            currentChunk += word + " ";
          }
        }
      } else {
        currentChunk = line + "\n";
      }
    } else {
      currentChunk += line + "\n";
    }
  }

  // Push remaining chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Send text message, automatically splitting if too long
 * @param {string} recipient - Recipient phone number
 * @param {string} text - Message text
 * @returns {Promise<void>}
 */
export async function sendTextMessage(recipient, text) {
  const chunks = splitLongMessage(text);

  if (chunks.length === 1) {
    // Send single message
    const messageData = getTextMessageInput(recipient, chunks[0]);
    await sendMessage(messageData);
  } else {
    // Send multiple messages
    console.log(`📨 Message split into ${chunks.length} parts`);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const prefix = chunks.length > 1 ? `(${i + 1}/${chunks.length})\n` : "";
      const messageData = getTextMessageInput(recipient, prefix + chunk);
      await sendMessage(messageData);
      
      // Small delay between messages to maintain order
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
}

/**
 * Send message via WhatsApp Cloud API
 * Equivalent to send_message() in Flask
 */
export async function sendMessage(data) {
  try {
    const url = `https://graph.facebook.com/${config.VERSION}/${config.PHONE_NUMBER_ID}/messages`;
    
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.ACCESS_TOKEN}`,
    };

    console.log("📤 Sending message to WhatsApp API:", {
      url,
      data: JSON.stringify(data),
    });

    const response = await axios.post(url, data, {
      headers,
      timeout: 10000, // 10 second timeout
    });

    logHttpResponse(response);
    return response;

  } catch (error) {
    console.error("❌ Failed to send message:", error.response?.data || error.message);
    
    if (error.code === "ECONNABORTED") {
      throw new Error("Request timed out");
    }
    
    throw new Error("Failed to send message");
  }
}

/**
 * Process text for WhatsApp formatting
 * Equivalent to process_text_for_whatsapp() in Flask
 * 
 * - Removes Chinese brackets 【】
 * - Converts ** to * for WhatsApp bold formatting
 */
export function processTextForWhatsApp(text) {
  // Remove Chinese brackets and content
  let processed = text.replace(/【[^】]*】/g, "");
  
  // Convert double asterisks to single (WhatsApp uses single * for bold)
  processed = processed.replace(/\*\*/g, "*");
  
  return processed;
}

/**
 * Process WhatsApp message
 * Equivalent to process_whatsapp_message() in Flask
 * 
 * Extracts message data and generates response
 */
export async function processWhatsAppMessage(body) {
  try {
    // Extract message details from webhook payload
    const entry = body.entry[0];
    const changes = entry.changes[0];
    const value = changes.value;
    
    // Extract contact information
    const contact = value.contacts[0];
    const waId = contact.wa_id;
    const name = contact.profile.name;
    
    // Extract message
    const message = value.messages[0];
    let messageBody = message.text?.body;
    const messageFrom = message.from;
    
    // Detect if this is a group message (context.from ends with @g.us in Cloud API)
    const isGroup = value.metadata?.display_phone_number !== messageFrom;
    
    // Bot configuration for mentions
    const BOT_NUMBER = config.PHONE_NUMBER_ID || "918838975981";
    const BOT_NAME = "Skulpt";
    
    // Check if bot is mentioned in a group message
    const isBotNameMention = isGroup && messageBody && 
      (messageBody.toLowerCase().includes(`@${BOT_NAME.toLowerCase()}`) || 
       messageBody.toLowerCase().includes('@sculpt'));
    
    const isBotNumberMention = isGroup && messageBody && 
      messageBody.includes('@') && 
      (messageBody.includes(BOT_NUMBER) || messageBody.includes(`+${BOT_NUMBER}`));
    
    // Debug logging for @ popup detection
    if (isGroup && messageBody && messageBody.includes('@')) {
      console.log(`🔍 @ popup detection: "${messageBody}" | looking for: ${BOT_NUMBER} | botNameMention: ${isBotNameMention} | botNumberMention: ${isBotNumberMention}`);
    }
    
    // Skip processing if it's a group message without bot mention
    if (isGroup && !isBotNameMention && !isBotNumberMention) {
      console.log("⏭️ Skipping group message - bot not mentioned");
      return;
    }
    
    // Clean the message body by removing bot mentions
    if (messageBody && (isBotNameMention || isBotNumberMention)) {
      if (isBotNameMention) {
        messageBody = messageBody
          .replace(new RegExp(`@${BOT_NAME}\\s*`, 'gi'), '')
          .replace(/@sculpt\s*/gi, '')
          .trim();
      }
      if (isBotNumberMention) {
        messageBody = messageBody.replace(/@\d+\s*/g, '').trim();
      }
      console.log(`🧹 Cleaned message: "${messageBody}"`);
    }
    
    console.log("📨 Processing message:", {
      from: messageFrom,
      wa_id: waId,
      name: name,
      body: messageBody,
      isGroup: isGroup,
      isBotMentioned: isBotNameMention || isBotNumberMention,
    });

    // Generate response based on message content
    // This is where you implement your business logic
    const response = await generateResponse(messageBody, waId, name, message, isGroup);
    
    if (response) {
      // Format and send response (automatically splits if too long)
      const processedText = processTextForWhatsApp(response);
      await sendTextMessage(waId, processedText);
    }

  } catch (error) {
    console.error("❌ Error processing WhatsApp message:", error);
    throw error;
  }
}

/**
 * Validate WhatsApp message structure
 * Equivalent to is_valid_whatsapp_message() in Flask
 * 
 * Checks if the webhook payload has the correct structure:
 * body → entry[0] → changes[0] → value → messages[0]
 */
export function isValidWhatsAppMessage(body) {
  try {
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
  } catch (error) {
    console.error("❌ Error validating message structure:", error);
    return false;
  }
}
