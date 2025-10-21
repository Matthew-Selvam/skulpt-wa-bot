# Invoice Letterhead Template Setup

## Overview
The bot now supports custom letterhead templates for professional invoice generation. You can use your company's letterhead design as a background for invoices.

## Current Configuration
- **Company Name**: THYNK UNLIMITED
- **Company Tagline**: Creative Company
- **Letterhead Status**: Disabled (will use default invoice format)

## How to Enable Letterhead Invoices

### Step 1: Prepare Your Letterhead Template
1. Create a high-quality PNG/JPEG image of your letterhead
2. Ensure it's A4 size (612x792 pixels or 8.5x11 inches at 72 DPI)
3. Make sure there's a clear blank area in the middle for invoice content
4. Save it as `letterhead_template.png` in the project root

### Step 2: Update Configuration
In `bot.js`, change these settings:
```javascript
const USE_LETTERHEAD = true; // Enable letterhead
const LETTERHEAD_PATH = "./letterhead_template.png"; // Path to your template
const COMPANY_NAME = "YOUR COMPANY NAME"; // Your company name
const COMPANY_TAGLINE = "YOUR TAGLINE"; // Your company tagline
```

### Step 3: Test
1. Restart the bot
2. Place a test order
3. Check the generated invoice

## Invoice Content Layout (with Letterhead)
When letterhead is enabled, the invoice content will be positioned in the blank area:
- **Title**: Trophy Order Invoice (centered)
- **Order Details**: Order ID, Date, Customer
- **Items List**: Numbered list with prices
- **Customization**: Customer's custom text
- **Total**: Right-aligned total amount

## File Structure
```
project/
├── bot.js
├── letterhead_template.png  # Your letterhead template
├── invoice_[order_id].pdf   # Generated invoices
└── README_INVOICE.md        # This file
```

## Notes
- The system automatically detects if the letterhead file exists
- If letterhead is disabled or file not found, it uses the default format
- Generated invoices are saved as PDF files
- Each invoice has a unique filename based on order ID

## Example Letterhead Design
Based on the provided template, the system expects:
- Company logo and name at the top
- Contact information at the bottom
- Large blank area in the middle for invoice content
- Professional color scheme (dark gray, white, orange accents)

## Current Status
✅ **System Ready**: Letterhead support implemented  
⏳ **Waiting for Template**: Currently using default invoice format  
🔧 **Easy Activation**: Just flip the switch when you get the template  

## Features
- **Automatic Detection**: Checks if letterhead file exists
- **Fallback Support**: Uses default format if letterhead unavailable
- **Professional Layout**: Content positioned in blank area
- **Company Branding**: Integrates your company name and details

## Quick Start
1. Get letterhead template from client
2. Save as `letterhead_template.png` in project folder
3. Set `USE_LETTERHEAD = true` in bot.js
4. Restart bot
5. Test with a sample order

The system is ready to use your professional letterhead template! 🏆
