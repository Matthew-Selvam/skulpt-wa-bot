// locales/hi.js - Hindi strings.
//
// Command keywords (browse, checkout, pay, cancel...) are deliberately left in
// English: they are what the customer must actually type, and the parser only
// recognises the English forms. Hindi speakers commonly type Latin-script
// commands anyway. Any key missing here falls back to English automatically.
export default {
  welcome: "👋 TrophyBot में आपका स्वागत है!\nहमारी ट्रॉफ़ियाँ देखने के लिए *browse* भेजें।",

  greeting:
    "👋 नमस्ते! TrophyBot में आपका स्वागत है! 🏆\n\nमैं आपकी मदद कर सकता हूँ:\n• हमारी ट्रॉफ़ी संग्रह देखने में\n• कस्टम ऑर्डर देने में\n• डिलीवरी ट्रैक करने में\n\nट्रॉफ़ियाँ देखने के लिए *browse* या विकल्पों के लिए *help* भेजें!",

  help: "🆘 TrophyBot का उपयोग कैसे करें:\n\n📋 *कमांड:*\n• *browse* - उपलब्ध ट्रॉफ़ियाँ देखें\n• *history* - आपके पिछले ऑर्डर\n• *reorder 1* - पुराना ऑर्डर दोबारा दें\n• *status* - मौजूदा ऑर्डर की स्थिति\n• *cancel* - बिना भुगतान वाला ऑर्डर रद्द करें\n• *language* - भाषा बदलें\n• *reset* - फिर से शुरू करें\n• *help* - यह मेन्यू दिखाएँ\n\n🛒 *ऑर्डर प्रक्रिया:*\n1. *browse* भेजें\n2. नंबर से ट्रॉफ़ी चुनें\n3. कस्टमाइज़ेशन भेजें (टेक्स्ट, या *फ़ोटो*)\n4. *checkout* फिर *pay* भेजें\n5. डिलीवरी ट्रैक करें",

  catalogHeader: "🏆 *उपलब्ध ट्रॉफ़ियाँ:*\n\n",
  catalogFooter:
    "\n💡 *ऑर्डर कैसे करें:*\n• ट्रॉफ़ी चुनने के लिए *नंबर* भेजें\n• अपना कस्टमाइज़ेशन टेक्स्ट जोड़ें\n• चेकआउट पर जाएँ\n\n🛒 शुरू करने के लिए बस एक नंबर भेजें!",
  catalogEmpty: "⚠️ कैटलॉग में कोई ट्रॉफ़ी नहीं मिली।",

  trophyAdded: ({ name }) =>
    `✅ *${name}* कार्ट में जोड़ी गई! 🛒\n\n🖊 *कस्टमाइज़ेशन:*\nकृपया वह टेक्स्ट भेजें जो आप ट्रॉफ़ी पर उकेरवाना चाहते हैं।\n\n💡 *उदाहरण:*\n• "Best Employee 2024"\n• "Championship Winner"\n• "Outstanding Performance"\n\nबस अपना कस्टमाइज़ेशन टेक्स्ट भेजें!`,
  invalidChoice: "⚠️ ग़लत विकल्प। कृपया दोबारा कोशिश करें।",

  customizationAdded: ({ text, photoNote }) =>
    `✅ *कस्टमाइज़ेशन जोड़ा गया!* ✨\n\n📝 *आपका कस्टमाइज़ेशन:* "${text}"${photoNote}\n\n🛒 *चेकआउट के लिए तैयार?*\nआगे बढ़ने के लिए *checkout* भेजें!`,
  photoReceived: "\n🖼 *संदर्भ चित्र प्राप्त हुआ*",
  photoAttached: "\n🖼 *संदर्भ चित्र संलग्न है*",
  photoHint: "\n💡 आप डिज़ाइन संदर्भ के लिए *फ़ोटो* भी भेज सकते हैं।",

  orderSummary: ({ items, customization, total, eta, photoLine }) =>
    `🛒 *ऑर्डर सारांश:*\n\n📦 *वस्तुएँ:*\n${items}\n\n📝 *कस्टमाइज़ेशन:* "${customization}"${photoLine}\n\n💰 *कुल राशि: ₹${total}*\n🚚 *अनुमानित डिलीवरी:* ${eta}\n\n💳 *भुगतान के लिए तैयार?*\nऑर्डर पक्का करने के लिए *pay* भेजें!\n\n_ऑर्डर रद्द करने के लिए *cancel* भेजें।_`,

  orderConfirmed:
    "🎉 *ऑर्डर पक्का हो गया!* ✅\n\n📄 *इनवॉइस संलग्न है*\n🚚 *डिलीवरी ट्रैकिंग जल्द शुरू होगी*\n\nTrophyBot चुनने के लिए धन्यवाद! 🏆",
  invoiceFailed: "⚠️ इनवॉइस नहीं बन सका।",

  orderStatus: ({ id, total, status, date, items }) =>
    `📦 आपके ऑर्डर की स्थिति:\n\n🆔 ऑर्डर आईडी: ${id}\n💰 कुल: ₹${total}\n📊 स्थिति: ${status}\n📅 तारीख़: ${date}\n\nवस्तुएँ: ${items}`,
  noActiveOrders: "❓ कोई सक्रिय ऑर्डर नहीं मिला। ख़रीदारी शुरू करने के लिए *browse* भेजें!",

  historyHeader: "📚 *आपके हाल के ऑर्डर:*\n\n",
  historyFooter: "🔁 वही दोबारा ऑर्डर करने के लिए *reorder 1* (या कोई और नंबर) भेजें।",
  historyEmpty: "📭 अभी तक कोई पुराना ऑर्डर नहीं। पहला ऑर्डर देने के लिए *browse* भेजें!",

  reordering: ({ items, customization, total }) =>
    `🔁 *दोबारा ऑर्डर:*\n\n📦 ${items}\n📝 *कस्टमाइज़ेशन:* "${customization}"\n💰 *कुल: ₹${total}*\n\nपक्का करने के लिए *checkout*, या फिर से शुरू करने के लिए *reset* भेजें।`,
  reorderNotFound: "⚠️ ऐसा कोई ऑर्डर नहीं। हाल के ऑर्डर देखने के लिए *history* भेजें।",

  cancelled: "🚫 ऑर्डर रद्द कर दिया गया। नया ऑर्डर शुरू करने के लिए *browse* भेजें।",
  cancelNothing: "❓ रद्द करने के लिए कुछ नहीं है। ऑर्डर शुरू करने के लिए *browse* भेजें।",
  cancelAlreadyPaid: ({ id }) =>
    `⚠️ ऑर्डर *${id}* का भुगतान हो चुका है और इसे यहाँ रद्द नहीं किया जा सकता।\nकृपया सीधे हमसे संपर्क करें।`,
  customizationCancelled: "🔄 रद्द कर दिया गया। दोबारा शुरू करने के लिए *browse* भेजें।",

  reset: "🔄 सेशन रीसेट हो गया! ट्रॉफ़ियाँ देखने के लिए *browse* भेजें।",

  languagePrompt:
    "🌐 *अपनी भाषा चुनें:*\n\n1. English\n2. हिन्दी (Hindi)\n\nनंबर भेजें।",
  languageSet: "✅ भाषा हिन्दी में सेट कर दी गई।",

  fallbackWelcome:
    "❓ मैं समझ नहीं पाया। कोशिश करें:\n• *browse* - ट्रॉफ़ियाँ देखें\n• *help* - कमांड देखें\n• *hi* - शुरू करें",
  fallbackBrowse: "❓ ट्रॉफ़ी चुनने के लिए कृपया *नंबर* भेजें, या विकल्पों के लिए *help* भेजें।",
  fallbackCheckout: "❓ अपना ऑर्डर आगे बढ़ाने के लिए *checkout* भेजें।",
  fallbackPayment: "❓ ऑर्डर पक्का करने के लिए *pay* भेजें।",
  fallbackGeneric:
    "❓ उत्पाद देखने के लिए *browse*, फिर से शुरू करने के लिए *reset*, या विकल्पों के लिए *help* भेजें।",
};
