import * as fs from 'fs';

const categories = [
  "Fake emails pretending to be banks, Amazon, Netflix",
  "Spear Phishing",
  "Whaling",
  "Clone Phishing",
  "Business Email Compromise (BEC)",
  "Smishing",
  "Vishing",
  "QR Phishing (Quishing)",
  "Social Media Phishing",
  "Angler Phishing",
  "UPI Scam",
  "OTP Scam",
  "Bank KYC Scam",
  "Credit Card Fraud",
  "Fake Payment Screenshot Scam",
  "Refund Scam",
  "Investment Scam",
  "Cryptocurrency Scam",
  "Ponzi Scheme",
  "Loan App Scam",
  "Fake Website",
  "Typosquatting",
  "Drive-by Download",
  "Malvertising",
  "Browser Notification Scam",
  "Tech Support Scam",
  "Fake CAPTCHA Scam",
  "Malicious Apps",
  "Fake APK Downloads",
  "Banking Trojan",
  "SIM Swap Attack",
  "Mobile Spyware",
  "Fake Updates",
  "Password Theft",
  "Credential Stuffing",
  "Brute Force Attack",
  "Password Spraying",
  "Session Hijacking",
  "Cookie Theft",
  "MFA Fatigue Attack",
  "Virus",
  "Worm",
  "Trojan",
  "Ransomware",
  "Spyware",
  "Adware",
  "Keylogger",
  "Rootkit",
  "Botnet Malware",
  "Cryptojacking",
  "Deepfake Voice Scam",
  "Deepfake Video Scam",
  "AI Phishing Emails",
  "AI Chat Impersonation",
  "AI-generated Fake Documents",
  "CEO Fraud",
  "Invoice Fraud",
  "Vendor Impersonation",
  "HR Recruitment Scam",
  "Fake Interview Scam",
  "Remote Job Scam",
  "Fake Shopping Website",
  "Fake Product Listing",
  "Marketplace Scam",
  "Delivery Scam",
  "Package Tracking Scam",
  "Romance Scam",
  "Catfishing",
  "Sextortion",
  "Friendship Scam",
  "Fake Free Skins",
  "Fake Game Currency",
  "Account Recovery Scam",
  "Gaming Marketplace Fraud",
  "Identity Theft",
  "Data Breach Exploitation",
  "Personal Information Harvesting",
  "Fake Survey Scam",
  "Fake Contest Scam",
  "Man-in-the-Middle (MITM)",
  "DNS Spoofing",
  "Rogue Wi-Fi Hotspot",
  "Evil Twin Wi-Fi Attack",
  "Packet Sniffing",
  "DDoS Attack"
];

function generateStimulus(id: number, tier: number, type: string, senderText: string, senderSuspicious: boolean, senderReason: string|null, contentText: string, contentSuspicious: boolean, contentReason: string|null, urlText: string|null, urlSuspicious: boolean, urlReason: string|null, amountText: string|null, amountSuspicious: boolean, amountReason: string|null, globalExplanation: string) {
  let s = `{
    id: "g${id}", type: "${type}" as any,
    sender: { text: ${JSON.stringify(senderText)}, isSuspicious: ${senderSuspicious}, ${senderReason ? `reason: '${senderReason}' as any,` : ''} explanation: ${JSON.stringify(senderSuspicious ? "Suspicious sender." : "Legitimate sender.")} },
    content: { text: ${JSON.stringify(contentText)}, isSuspicious: ${contentSuspicious}, ${contentReason ? `reason: '${contentReason}' as any,` : ''} explanation: ${JSON.stringify(contentSuspicious ? "Suspicious content." : "Standard content.")} },`;
  
  if (urlText) {
    s += `\n    actionUrl: { text: ${JSON.stringify(urlText)}, isSuspicious: ${urlSuspicious}, ${urlReason ? `reason: '${urlReason}' as any,` : ''} explanation: ${JSON.stringify(urlSuspicious ? "Suspicious URL." : "Official URL.")} },`;
  }
  
  if (amountText) {
    s += `\n    amount: { text: ${JSON.stringify(amountText)}, isSuspicious: ${amountSuspicious}, ${amountReason ? `reason: '${amountReason}' as any,` : ''} explanation: ${JSON.stringify(amountSuspicious ? "Suspicious amount." : "Standard amount.")} },`;
  }
  
  s += `\n    difficultyTier: ${tier} as any, explanation: ${JSON.stringify(globalExplanation)}\n  }`;
  return s;
}

const safeTemplates = [
  { t: "SMS", s: "HDFC-Bank", c: "Your account balance is Rs 5,420.00.", e: "Legitimate bank SMS." },
  { t: "EMAIL", s: "support@netflix.com", c: "Here are some top picks for you this week.", e: "Legitimate marketing email." },
  { t: "WHATSAPP", s: "Mom", c: "Call me when you are free.", e: "Legitimate personal message." },
  { t: "UPI", s: "Zomato", c: "Order payment", a: "₹ 340", e: "Legitimate Zomato order." },
  { t: "SOCIAL", s: "LinkedIn Updates", c: "You appeared in 12 searches this week.", e: "Legitimate social update." },
];

let stimuliList: string[] = [];
let idCounter = 1;

categories.forEach((cat, index) => {
  let tier = Math.floor(Math.random() * 5) + 1;
  let type = ["SMS", "WHATSAPP", "EMAIL", "SOCIAL", "UPI"][Math.floor(Math.random() * 5)];
  
  let sender = `Alert-${cat.substring(0, 8).replace(/\\s/g, '')}`;
  let content = `Urgent message regarding ${cat}. Please review immediately.`;
  let url: string | null = `http://verify-${cat.substring(0, 5).replace(/\\s/g, '').toLowerCase()}-update.com`;
  let reason1 = ["Fake Sender/Identity", "Impersonation or Fake Branding"][Math.floor(Math.random() * 2)];
  let reason2 = ["Urgency or Pressure Tactic", "Request for Sensitive Information"][Math.floor(Math.random() * 2)];
  
  let amount: string | null = null;
  if (type === "UPI") {
    amount = `₹ ${Math.floor(Math.random() * 50000) + 1000}`;
  }

  if (cat.includes("CEO") || cat.includes("Whaling")) { type = "EMAIL"; sender = "ceo@company-secure.net"; content = "Wire transfer needed ASAP for new acquisition."; url = null; }
  if (cat.includes("Smishing")) { type = "SMS"; sender = "TX-GOVT"; content = "Your tax refund is pending. Claim now."; url = "http://claim-tax-refund.net"; }
  if (cat.includes("UPI")) { type = "UPI"; sender = "cashback@ybl"; content = "You received a reward. Enter PIN to claim."; amount = "₹ 5000"; url = null; }
  if (cat.includes("Social Media") || cat.includes("Friendship") || cat.includes("Romance") || cat.includes("Sextortion")) { type = "SOCIAL"; sender = "Sarah_99"; content = "Hey I saw your photo here, is this you??"; url = "http://instgrm-login-pic.com"; }
  if (cat.includes("Investment") || cat.includes("Crypto") || cat.includes("Ponzi")) { type = "WHATSAPP"; sender = "+44 7700 900077"; content = "Guaranteed 200% returns in 24 hours. Join VIP group."; url = "http://t.me/crypto-scam"; }
  if (cat.includes("Delivery") || cat.includes("Package")) { type = "SMS"; sender = "POST-OFFICE"; content = "Your package was delayed. Update address here."; url = "http://post-redelivery.com"; }
  if (cat.includes("Bank KYC")) { type = "WHATSAPP"; sender = "HDFC-Support"; content = "Your account will be suspended. Please update KYC."; url = "http://kyc-update-portal.com"; }

  stimuliList.push(generateStimulus(
    idCounter++, tier, type, 
    sender, true, reason1, 
    content, true, reason2, 
    url, url ? true : false, url ? "Suspicious Link or URL" : null,
    amount, amount ? true : false, amount ? "Request for Sensitive Information" : null,
    `Scam related to ${cat}.`
  ));
  
  if (index % 3 === 0) {
    let safe = safeTemplates[Math.floor(Math.random() * safeTemplates.length)];
    stimuliList.push(generateStimulus(
      idCounter++, tier, safe.t,
      safe.s, false, null,
      safe.c, false, null,
      safe.t === "EMAIL" ? "https://netflix.com" : null, false, null,
      safe.a || null, false, null,
      safe.e
    ));
  }
});

for (let i = 0; i < 20; i++) {
  let tier = Math.floor(Math.random() * 5) + 1;
  let type = ["SMS", "WHATSAPP", "EMAIL", "SOCIAL", "UPI"][Math.floor(Math.random() * 5)];
  let isSafe = Math.random() > 0.7;

  if (isSafe) {
    let safe = safeTemplates[Math.floor(Math.random() * safeTemplates.length)];
    stimuliList.push(generateStimulus(
      idCounter++, tier, safe.t,
      safe.s, false, null,
      safe.c, false, null,
      null, false, null,
      safe.a || null, false, null,
      safe.e
    ));
  } else {
    stimuliList.push(generateStimulus(
      idCounter++, tier, type, 
      "Support_Team", true, "Impersonation or Fake Branding", 
      "Your account will be deleted in 24 hrs. Please update your details.", true, "Urgency or Pressure Tactic", 
      "http://verify-account-now.net", true, "Suspicious Link or URL",
      null, false, null,
      `Standard account deletion phishing.`
    ));
  }
}

const tsCode = "import { Stimulus, RoundSummary } from \"../types\";\n\n" +
"export const ROUND_SUMMARIES: Record<number, RoundSummary> = {\n" +
"  1: { name: \"Level 1: Routine Sweeps\", teaser: \"Basic hygiene checks. Keep your eyes open.\" },\n" +
"  2: { name: \"Level 2: Closer Look\", teaser: \"Sometimes the devil is in the details.\" },\n" +
"  3: { name: \"Level 3: Deep Verification\", teaser: \"Look deeper. Verification is tricky.\" },\n" +
"  4: { name: \"Level 4: High Stakes\", teaser: \"These are crafted to pressure you.\" },\n" +
"  5: { name: \"Level 5: Master Investigator\", teaser: \"Only the best spot these.\" }\n" +
"};\n\n" +
"export const TUTORIAL_STIMULI: Stimulus[] = [\n" +
"  { id: \"t1\", type: \"SMS\", sender: { text: \"AX-HDFCBK\", isSuspicious: false, explanation: \"Valid\" }, content: { text: \"RS 5,000 debited.\", isSuspicious: false, explanation: \"Valid\" }, difficultyTier: 1, explanation: \"Safe.\" },\n" +
"  { id: \"t2\", type: \"WHATSAPP\", sender: { text: \"+91 98765 43210\", isSuspicious: true, reason: \"Fake Sender/Identity\", explanation: \"Personal number.\" }, content: { text: \"Electricity disconnect tonight.\", isSuspicious: true, reason: \"Urgency or Pressure Tactic\", explanation: \"Urgency.\" }, difficultyTier: 1, explanation: \"Scam.\" },\n" +
"  { id: \"t3\", type: \"EMAIL\", sender: { text: \"admin@paypal-update.com\", isSuspicious: true, reason: \"Fake Sender/Identity\", explanation: \"Fake domain.\" }, content: { text: \"Verify now.\", isSuspicious: true, reason: \"Urgency or Pressure Tactic\", explanation: \"Urgency.\" }, actionUrl: { text: \"http://paypal.verify.net\", isSuspicious: true, reason: \"Suspicious Link or URL\", explanation: \"Fake URL.\" }, difficultyTier: 1, explanation: \"Phishing.\" }\n" +
"];\n\n" +
"export const GAME_STIMULI: Stimulus[] = [\n" +
stimuliList.join(',\n') +
"\n];\n\n" +
"export function getStimuliForTier(tier: number): Stimulus[] {\n" +
"  const available = GAME_STIMULI.filter(s => s.difficultyTier === tier);\n" +
"  const shuffled = [...available].sort(() => 0.5 - Math.random());\n" +
"  return shuffled.slice(0, 5);\n" +
"}\n";

fs.writeFileSync('src/data/stimuli.ts', tsCode);
console.log("Successfully generated stimuli with length: " + stimuliList.length);
