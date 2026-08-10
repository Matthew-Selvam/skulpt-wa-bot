// whatsapp-api-client.js - WhatsApp Business API Client
import fetch from "node-fetch";
import productionConfig from "./production-config.js";

class WhatsAppBusinessAPI {
  constructor() {
    this.accessToken = productionConfig.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = productionConfig.WHATSAPP_PHONE_NUMBER_ID;
    this.businessAccountId = productionConfig.WHATSAPP_BUSINESS_ACCOUNT_ID;
    this.baseURL = "https://graph.facebook.com/v18.0";
  }

  // Send text message
  async sendMessage(to, message) {
    try {
      const url = `${this.baseURL}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: {
          body: message
        }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log("✅ Message sent successfully:", result);
        return { success: true, messageId: result.messages[0].id };
      } else {
        console.error("❌ Failed to send message:", result);
        return { success: false, error: result };
      }
    } catch (error) {
      console.error("❌ Error sending message:", error);
      return { success: false, error: error.message };
    }
  }

  // Upload a local file to the Cloud API and return its media ID.
  // Required for sending locally-generated files (e.g. invoice PDFs): the
  // messages endpoint only accepts a publicly reachable `link`, so anything
  // generated on disk has to be uploaded here first.
  async uploadMedia(filePath, mimeType = "application/pdf") {
    try {
      const fs = await import("fs");
      const FormData = (await import("form-data")).default;

      const url = `${this.baseURL}/${this.phoneNumberId}/media`;

      const formData = new FormData();
      formData.append("messaging_product", "whatsapp");
      formData.append("file", fs.createReadStream(filePath), {
        contentType: mimeType,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          ...formData.getHeaders(),
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.id) {
        console.log("✅ Media uploaded successfully:", result.id);
        return { success: true, mediaId: result.id };
      }

      console.error("❌ Failed to upload media:", result);
      return { success: false, error: result };
    } catch (error) {
      console.error("❌ Error uploading media:", error);
      return { success: false, error: error.message };
    }
  }

  // Send a document that exists on the local filesystem (upload, then send by ID)
  async sendDocumentFromFile(to, filePath, filename, caption = "") {
    const upload = await this.uploadMedia(filePath, "application/pdf");
    if (!upload.success) {
      return { success: false, error: upload.error };
    }

    try {
      const url = `${this.baseURL}/${this.phoneNumberId}/messages`;

      const payload = {
        messaging_product: "whatsapp",
        to: to,
        type: "document",
        document: {
          id: upload.mediaId,
          filename: filename,
          caption: caption,
        },
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        console.log("✅ Document sent successfully:", result);
        return { success: true, messageId: result.messages[0].id };
      }

      console.error("❌ Failed to send document:", result);
      return { success: false, error: result };
    } catch (error) {
      console.error("❌ Error sending document:", error);
      return { success: false, error: error.message };
    }
  }

  // Send media message (document/image) by public URL
  async sendMediaMessage(to, mediaUrl, caption = "", type = "document") {
    try {
      const url = `${this.baseURL}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: "whatsapp",
        to: to,
        type: type,
        [type]: {
          link: mediaUrl,
          caption: caption
        }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log("✅ Media message sent successfully:", result);
        return { success: true, messageId: result.messages[0].id };
      } else {
        console.error("❌ Failed to send media message:", result);
        return { success: false, error: result };
      }
    } catch (error) {
      console.error("❌ Error sending media message:", error);
      return { success: false, error: error.message };
    }
  }

  // Send template message
  async sendTemplateMessage(to, templateName, languageCode = "en", components = []) {
    try {
      const url = `${this.baseURL}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: "whatsapp",
        to: to,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode
          },
          components: components
        }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log("✅ Template message sent successfully:", result);
        return { success: true, messageId: result.messages[0].id };
      } else {
        console.error("❌ Failed to send template message:", result);
        return { success: false, error: result };
      }
    } catch (error) {
      console.error("❌ Error sending template message:", error);
      return { success: false, error: error.message };
    }
  }

  // Mark message as read
  async markAsRead(messageId) {
    try {
      const url = `${this.baseURL}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log("✅ Message marked as read:", result);
        return { success: true };
      } else {
        console.error("❌ Failed to mark message as read:", result);
        return { success: false, error: result };
      }
    } catch (error) {
      console.error("❌ Error marking message as read:", error);
      return { success: false, error: error.message };
    }
  }

  // Get media URL
  async getMediaUrl(mediaId) {
    try {
      const url = `${this.baseURL}/${mediaId}`;
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        return { success: true, url: result.url };
      } else {
        console.error("❌ Failed to get media URL:", result);
        return { success: false, error: result };
      }
    } catch (error) {
      console.error("❌ Error getting media URL:", error);
      return { success: false, error: error.message };
    }
  }

  // Download media
  async downloadMedia(mediaUrl) {
    try {
      const response = await fetch(mediaUrl, {
        headers: {
          "Authorization": `Bearer ${this.accessToken}`
        }
      });

      if (response.ok) {
        const buffer = await response.buffer();
        return { success: true, data: buffer };
      } else {
        console.error("❌ Failed to download media");
        return { success: false, error: "Failed to download media" };
      }
    } catch (error) {
      console.error("❌ Error downloading media:", error);
      return { success: false, error: error.message };
    }
  }
}

export default WhatsAppBusinessAPI;
