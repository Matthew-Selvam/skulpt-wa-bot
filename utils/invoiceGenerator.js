// utils/invoiceGenerator.js - Invoice generation utility
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { config } from "../config/config.js";

/**
 * Generate PDF invoice for an order
 * Equivalent to generateInvoice() in bot.js
 */
export async function generateInvoice(order, useLetterhead = false, letterheadPath = null) {
  const filePath = path.join(process.cwd(), `invoices`, `invoice_${order._id}.pdf`);
  
  // Ensure invoices directory exists
  const invoiceDir = path.join(process.cwd(), "invoices");
  if (!fs.existsSync(invoiceDir)) {
    fs.mkdirSync(invoiceDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // If letterhead template is provided, use it
    if (useLetterhead && letterheadPath && fs.existsSync(letterheadPath)) {
      // Add letterhead as background image
      doc.image(letterheadPath, 0, 0, { width: 612, height: 792 }); // A4 size

      // Add content in the blank area (adjust coordinates based on letterhead design)
      doc.fontSize(18).text("🏆 Trophy Order Invoice", 50, 200, { align: "center" });
      doc.moveDown(2);

      doc.fontSize(12).text(`Order ID: ${order._id}`, 50, 250);
      doc.text(`Date: ${order.createdAt.toDateString()}`, 50, 270);
      doc.text(`Customer: ${order.userId}`, 50, 290);
      doc.moveDown(2);

      // Items table
      let yPosition = 350;
      doc.text("Items:", 50, yPosition);
      yPosition += 20;

      order.items.forEach((item, index) => {
        doc.text(`${index + 1}. ${item.name}`, 70, yPosition);
        doc.text(`₹${item.price}`, 450, yPosition, { align: "right" });
        yPosition += 20;
      });

      // Customization
      if (order.customization) {
        doc.text(`Customization: ${order.customization}`, 50, yPosition + 10);
        yPosition += 30;
      }

      // Total
      doc.fontSize(14).text(`Total: ₹${order.total}`, 450, yPosition + 20, { align: "right" });
    } else {
      // Default invoice without letterhead
      doc.fontSize(20).text("🏆 Trophy Order Invoice", { align: "center" });
      doc.moveDown();

      doc.fontSize(12).text(`Order ID: ${order._id}`);
      doc.text(`Date: ${order.createdAt.toDateString()}`);
      doc.text(`Customer: ${order.userId}`);
      doc.text(`Company: ${config.COMPANY_NAME}`);
      doc.moveDown();

      doc.text("Items:", { underline: true });
      order.items.forEach((item, index) => {
        doc.text(`${index + 1}. ${item.name} - ₹${item.price}`);
      });

      if (order.customization) {
        doc.moveDown();
        doc.text(`Customization: ${order.customization}`);
      }

      doc.moveDown();
      doc.fontSize(14).text(`Total: ₹${order.total}`, { align: "right" });
    }

    doc.end();

    stream.on("finish", () => {
      console.log(`✅ Invoice generated: ${filePath}`);
      resolve(filePath);
    });
    stream.on("error", (err) => {
      console.error("❌ Invoice generation error:", err);
      reject(err);
    });
  });
}
