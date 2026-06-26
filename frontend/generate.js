const fs = require('fs');

const createStimuli = () => {
  let output = 'import { Stimulus, RoundSummary } from "../types";\n\n';
  output += 'export const ROUND_SUMMARIES: Record<number, RoundSummary> = {\n';
  output += '  1: { name: "Level 1: Routine Sweeps", teaser: "Basic hygiene checks. Keep your eyes open." },\n';
  output += '  2: { name: "Level 2: Closer Look", teaser: "Sometimes the devil is in the details." },\n';
  output += '  3: { name: "Level 3: Deep Verification", teaser: "Look deeper. Verification is tricky." },\n';
  output += '  4: { name: "Level 4: High Stakes", teaser: "These are crafted to pressure you." },\n';
  output += '  5: { name: "Level 5: Master Investigator", teaser: "Only the best spot these." }\n';
  output += '};\n\n';
  
  output += 'export const TUTORIAL_STIMULI: Stimulus[] = [\n';
  output += '  { id: "t1", type: "SMS", sender: { text: "AX-HDFCBK", isSuspicious: false, explanation: "Valid" }, content: { text: "RS 5,000 debited.", isSuspicious: false, explanation: "Valid" }, difficultyTier: 1, explanation: "Safe." },\n';
  output += '  { id: "t2", type: "WHATSAPP", sender: { text: "+91 98765 43210", isSuspicious: true, reason: "Fake Sender/Identity", explanation: "Personal number." }, content: { text: "Electricity disconnect tonight.", isSuspicious: true, reason: "Urgency or Pressure Tactic", explanation: "Urgency." }, difficultyTier: 1, explanation: "Scam." },\n';
  output += '  { id: "t3", type: "EMAIL", sender: { text: "admin@paypal-update.com", isSuspicious: true, reason: "Fake Sender/Identity", explanation: "Fake domain." }, content: { text: "Verify now.", isSuspicious: true, reason: "Urgency or Pressure Tactic", explanation: "Urgency." }, actionUrl: { text: "http://paypal.verify.net", isSuspicious: true, reason: "Suspicious Link or URL", explanation: "Fake URL." }, difficultyTier: 1, explanation: "Phishing." }\n';
  output += '];\n\n';
  
  output += 'export const GAME_STIMULI: Stimulus[] = [\n';
  
  const types = ['EMAIL', 'SMS', 'WHATSAPP', 'UPI'];
  const baseCompanies = ['Amazon', 'Netflix', 'PayPal', 'SBI', 'FedEx', 'IncomeTax', 'HR', 'LinkedIn'];
  let idCounter = 1;
  
  for(let tier=1; tier<=5; tier++) {
    for(let i=0; i<10; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const comp = baseCompanies[Math.floor(Math.random() * baseCompanies.length)];
      const isScam = Math.random() > 0.3; // 70% scam
      
      let sText = isScam ? `${comp}-Alert` : `no-reply@${comp.toLowerCase()}.com`;
      if(type === 'SMS') sText = isScam ? '+918888888888' : `AD-${comp.toUpperCase().substring(0,6)}`;
      if(type === 'UPI') sText = isScam ? `${comp.toLowerCase()}@ybl` : `${comp.toLowerCase()}@verified`;
      
      let cText = isScam ? `Urgent! Your ${comp} account is suspended. Verify now.` : `Your recent ${comp} statement is available.`;
      let uText = isScam ? `http://${comp.toLowerCase()}-verify-now.com` : `https://www.${comp.toLowerCase()}.com/login`;
      
      output += `  {
    id: "g${idCounter++}", type: "${type}",
    sender: { text: "${sText}", isSuspicious: ${isScam}, ${isScam ? "reason: 'Fake Sender/Identity', " : ""}explanation: "${isScam ? 'Suspicious sender format.' : 'Valid sender.'}" },
    content: { text: "${cText}", isSuspicious: ${isScam}, ${isScam ? "reason: 'Urgency or Pressure Tactic', " : ""}explanation: "${isScam ? 'Creates false urgency.' : 'Standard message.'}" },\n`;
      
      if(type !== 'UPI' || Math.random() > 0.5) {
         output += `    actionUrl: { text: "${uText}", isSuspicious: ${isScam}, ${isScam ? "reason: 'Suspicious Link or URL', " : ""}explanation: "${isScam ? 'Unofficial domain.' : 'Official URL.'}" },\n`;
      }
      
      if(type === 'UPI') {
         output += `    amount: { text: "₹ ${Math.floor(Math.random()*10000)}", isSuspicious: ${isScam}, ${isScam ? "reason: 'Request for Sensitive Information', " : ""}explanation: "${isScam ? 'Unsolicited request.' : 'Expected payment.'}" },\n`;
      }
      
      output += `    difficultyTier: ${tier}, explanation: "${isScam ? 'This is a phishing attempt.' : 'This is a legitimate message.'}"
  },\n`;
    }
  }
  
  output += '];\n\n';
  output += 'export function getStimuliForTier(tier: number): Stimulus[] {\n';
  output += '  const available = GAME_STIMULI.filter(s => s.difficultyTier === tier);\n';
  output += '  const shuffled = [...available].sort(() => 0.5 - Math.random());\n';
  output += '  return shuffled.slice(0, 5);\n';
  output += '}\n';
  
  fs.writeFileSync('src/data/stimuli.ts', output);
};

createStimuli();
