// services/messageHandler.js - Message processing logic (bot.js logic)
import { Trophy } from "../models/Trophy.js";
import { Order } from "../models/Order.js";
import { config } from "../config/config.js";
import { sendMessage, getTextMessageInput, sendTextMessage, sendDocument } from "../utils/whatsappUtils.js";
import { generateInvoice } from "../utils/invoiceGenerator.js";
import { mockDeliveryUpdates } from "../utils/deliveryTracker.js";
import path from "path";

// Session storage (in production, use Redis or database)
const sessions = new Map();

/**
 * Get or create session for user
 */
function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      step: "welcome",
      cart: [],
      customization: "",
      isGroup: false,
      groupId: null,
      userId: userId,
    });
  }
  return sessions.get(userId);
}

/**
 * Extract clean user number for display
 */
function getUserDisplayName(userId) {
  // Extract number from userId (format: 919966701272)
  return userId;
}

/**
 * Generate response based on message content
 * This is the main message handler equivalent to bot.js message handler
 */
export async function generateResponse(messageBody, waId, name, message, isGroup = false) {
  try {
    const session = getSession(waId);
    let text = messageBody.trim().toLowerCase();
    
    // Update session if this is a group message
    if (isGroup && !session.isGroup) {
      session.isGroup = true;
      session.groupId = message.from; // Store the group ID
    }

    console.log(`🔍 Processing message: "${messageBody}" -> cleaned: "${text}" | step: ${session.step} | isGroup: ${isGroup}`);

    // Detect message types
    const isGreeting = /^(hi|hello|hey|hii|hiii|good morning|good afternoon|good evening|namaste|namaskar)/.test(text);
    const isHelpRequest = /^(help|menu|start|begin|commands?)/.test(text);
    const isStatusRequest = /^(status|order|my order|track)/.test(text);

    // Handle greetings
    if (isGreeting) {
      const greetingMsg = isGroup
        ? `👋 Hello @${name}! Welcome to TrophyBot! 🏆\n\nI can help you:\n• Browse our trophy collection\n• Place custom orders\n• Track your deliveries\n\nType *browse* to see our trophies or *help* for more options!`
        : `👋 Hello ${name}! Welcome to TrophyBot! 🏆\n\nI can help you:\n• Browse our trophy collection\n• Place custom orders\n• Track your deliveries\n\nType *browse* to see our trophies or *help* for more options!`;
      return greetingMsg;
    }

    // Handle help requests
    if (isHelpRequest) {
      const helpMsg = isGroup
        ? `🆘 @${name} Here's how to use TrophyBot:\n\n📋 *Commands:*\n• *browse* - See available trophies\n• *reset* - Start over\n• *status* - Check your order\n• *help* - Show this menu\n\n🛒 *Order Process:*\n1. Browse trophies\n2. Select by number\n3. Add customization\n4. Checkout & pay\n5. Track delivery\n\n💡 *Tip:* You can reply to my messages or use @skulpt commands!`
        : `🆘 Here's how to use TrophyBot:\n\n📋 *Commands:*\n• *browse* - See available trophies\n• *reset* - Start over\n• *status* - Check your order\n• *help* - Show this menu\n\n🛒 *Order Process:*\n1. Browse trophies\n2. Select by number\n3. Add customization\n4. Checkout & pay\n5. Track delivery`;
      return helpMsg;
    }

    // Handle status requests
    if (isStatusRequest) {
      if (session.orderId) {
        const order = await Order.findById(session.orderId);
        if (order) {
          const statusMsg = isGroup
            ? `📦 @${name} Your Order Status:\n\n🆔 Order ID: ${order._id}\n💰 Total: ₹${order.total}\n📊 Status: ${order.status}\n📅 Date: ${order.createdAt.toDateString()}\n\nItems: ${order.items.map(item => item.name).join(', ')}`
            : `📦 Your Order Status:\n\n🆔 Order ID: ${order._id}\n💰 Total: ₹${order.total}\n📊 Status: ${order.status}\n📅 Date: ${order.createdAt.toDateString()}\n\nItems: ${order.items.map(item => item.name).join(', ')}`;
          return statusMsg;
        }
      }
      const noOrderMsg = isGroup
        ? `❓ @${name} No active orders found. Type *browse* to start shopping!`
        : "❓ No active orders found. Type *browse* to start shopping!";
      return noOrderMsg;
    }

    // Reset session if user says browse and session is done
    if (text === "browse" && session.step === "done") {
      session.step = "welcome";
      session.cart = [];
      session.customization = "";
      console.log("🔄 Session reset for user");
    }

    // Step 1: Browse
    if (session.step === "welcome" && (text === "browse" || text.includes("browse"))) {
      const trophies = await Trophy.find();
      if (trophies.length === 0) {
        const noTrophiesMsg = isGroup
          ? `⚠️ @${name} No trophies found in catalog.`
          : "⚠️ No trophies found in catalog.";
        return noTrophiesMsg;
      }

      let response = isGroup
        ? `🏆 *Available Trophies* @${name}:\n\n`
        : "🏆 *Available Trophies:*\n\n";
      trophies.forEach((t, i) => {
        response += `${i + 1}. ${t.name} - *₹${t.price}*\n`;
      });
      response += "\n💡 *How to order:*\n• Reply with the *number* to select a trophy\n• Add your customization text\n• Proceed to checkout\n\n🛒 Ready to start? Just reply with a number!";
      
      session.step = "browse";
      return response;
    }

    // Step 2: Add to cart
    if (session.step === "browse" && !isNaN(text)) {
      const index = parseInt(text) - 1;
      const trophies = await Trophy.find();
      if (trophies[index]) {
        const trophy = trophies[index];
        session.cart.push(trophy);
        session.step = "customization";
        const customMsg = isGroup
          ? `✅ @${name} *${trophy.name}* added to cart! 🛒\n\n🖊 *Customization:*\nPlease enter the text you want engraved on this trophy.\n\n💡 *Examples:*\n• "Best Employee 2024"\n• "Championship Winner"\n• "Outstanding Performance"\n\nJust reply with your customization text!`
          : `✅ *${trophy.name}* added to cart! 🛒\n\n🖊 *Customization:*\nPlease enter the text you want engraved on this trophy.\n\n💡 *Examples:*\n• "Best Employee 2024"\n• "Championship Winner"\n• "Outstanding Performance"\n\nJust reply with your customization text!`;
        return customMsg;
      } else {
        const invalidMsg = isGroup
          ? `⚠️ @${name} Invalid choice. Try again.`
          : "⚠️ Invalid choice. Try again.";
        return invalidMsg;
      }
    }

    // Step 3: Customization
    if (session.step === "customization") {
      session.customization = messageBody;
      session.step = "checkout";
      const checkoutMsg = isGroup
        ? `✅ @${name} *Customization added!* ✨\n\n📝 *Your customization:* "${messageBody}"\n\n🛒 *Ready to checkout?*\nReply *checkout* to proceed with your order!`
        : `✅ *Customization added!* ✨\n\n📝 *Your customization:* "${messageBody}"\n\n🛒 *Ready to checkout?*\nReply *checkout* to proceed with your order!`;
      return checkoutMsg;
    }

    // Step 4: Checkout
    if (session.step === "checkout" && (text === "checkout" || text.includes("checkout"))) {
      const total = session.cart.reduce((sum, item) => sum + item.price, 0);
      const order = new Order({
        userId: waId,
        items: session.cart,
        total,
        customization: session.customization,
        status: "pending",
        groupId: session.groupId,
      });
      await order.save();

      session.orderId = order._id;
      session.step = "payment";

      const paymentMsg = isGroup
        ? `🛒 @${name} *Order Summary:*\n\n📦 *Items:*\n${session.cart.map(item => `• ${item.name} - ₹${item.price}`).join('\n')}\n\n📝 *Customization:* "${session.customization}"\n\n💰 *Total Amount: ₹${total}*\n\n💳 *Ready to pay?*\nReply *pay* to confirm your order!`
        : `🛒 *Order Summary:*\n\n📦 *Items:*\n${session.cart.map(item => `• ${item.name} - ₹${item.price}`).join('\n')}\n\n📝 *Customization:* "${session.customization}"\n\n💰 *Total Amount: ₹${total}*\n\n💳 *Ready to pay?*\nReply *pay* to confirm your order!`;
      return paymentMsg;
    }

    // Step 5: Payment
    if (session.step === "payment" && (text === "pay" || text.includes("pay"))) {
      const order = await Order.findById(session.orderId);
      order.status = "paid";
      await order.save();

      try {
        // Generate invoice PDF
        const invoicePath = await generateInvoice(order, config.USE_LETTERHEAD, config.LETTERHEAD_PATH);
        
        // Send the invoice as PDF document
        const invoiceFilename = `Invoice_${order._id}.pdf`;
        const invoiceCaption = `🎉 *Order Confirmed!* ✅\n\nThank you for choosing TrophyBot! 🏆`;
        
        try {
          await sendDocument(waId, invoicePath, invoiceFilename, invoiceCaption);
          console.log("✅ Invoice PDF sent successfully");
        } catch (docError) {
          console.error("⚠️ Failed to send invoice document:", docError.message);
          // Fallback: Send text confirmation without PDF
          await sendTextMessage(waId, `${invoiceCaption}\n\n📄 Invoice: ${order._id}\n\n⚠️ Unable to attach PDF. Please contact support.`);
        }
        
        // Send additional confirmation message
        const confirmMsg = `📋 *Order Details:*\nOrder ID: ${order._id}\nTotal: ₹${order.total}\nStatus: Confirmed\n\n🚚 *Delivery tracking will start soon*`;
        await sendTextMessage(waId, confirmMsg);

        // Notify admin (fix the phone number format)
        if (config.ADMIN_NUMBER) {
          // Ensure admin number has country code prefix
          const adminNumber = config.ADMIN_NUMBER.startsWith('+') 
            ? config.ADMIN_NUMBER.substring(1) 
            : config.ADMIN_NUMBER.startsWith('91') 
              ? config.ADMIN_NUMBER 
              : '91' + config.ADMIN_NUMBER;
              
          const adminMsg = `📢 New Order Paid!\nID: ${order._id}\nTotal: ₹${order.total}\nCustomer: ${waId}`;
          
          try {
            await sendTextMessage(adminNumber, adminMsg);
          } catch (adminError) {
            console.error("⚠️ Failed to notify admin:", adminError.message);
            // Don't fail the entire order if admin notification fails
          }
        }

        // Start mock delivery tracking
        mockDeliveryUpdates(waId, false, null);

        session.step = "done";
        
        // Return null since we already sent the message
        return null;

      } catch (err) {
        console.error("❌ Invoice generation failed:", err);
        return "⚠️ Could not generate invoice.";
      }
    }

    // Reset command
    if (text === "reset" || text === "start" || text === "menu") {
      session.step = "welcome";
      session.cart = [];
      session.customization = "";
      const resetMsg = isGroup
        ? `🔄 @${name} Session reset! Reply *browse* to see our trophies.`
        : "🔄 Session reset! Reply *browse* to see our trophies.";
      return resetMsg;
    }

    // Fallback messages based on current step
    let fallbackMsg;
    if (session.step === "welcome") {
      fallbackMsg = isGroup
        ? `❓ @${name} I didn't understand that. Try:\n• *browse* - See trophies\n• *help* - Show commands\n• *hi* - Get started`
        : "❓ I didn't understand that. Try:\n• *browse* - See trophies\n• *help* - Show commands\n• *hi* - Get started";
    } else if (session.step === "browse") {
      fallbackMsg = isGroup
        ? `❓ @${name} Please reply with a *number* to select a trophy, or *help* for options.`
        : "❓ Please reply with a *number* to select a trophy, or *help* for options.";
    } else if (session.step === "customization") {
      fallbackMsg = isGroup
        ? `❓ @${name} Please enter your *customization text* for the trophy.`
        : "❓ Please enter your *customization text* for the trophy.";
    } else if (session.step === "checkout") {
      fallbackMsg = isGroup
        ? `❓ @${name} Reply *checkout* to proceed with your order.`
        : "❓ Reply *checkout* to proceed with your order.";
    } else if (session.step === "payment") {
      fallbackMsg = isGroup
        ? `❓ @${name} Reply *pay* to confirm your order.`
        : "❓ Reply *pay* to confirm your order.";
    } else {
      fallbackMsg = isGroup
        ? `❓ @${name} Please reply *browse* to see products, *reset* to start over, or *help* for options.`
        : "❓ Please reply *browse* to see products, *reset* to start over, or *help* for options.";
    }

    return fallbackMsg;

  } catch (error) {
    console.error("❌ Error generating response:", error);
    return "⚠️ Sorry, something went wrong. Please try again.";
  }
}
