const fs = require('fs');

const createStimuli = () => {
  let output = `import { Stimulus, RoundSummary } from "../types";\n\n`;
  output += `export const ROUND_SUMMARIES: Record<number, RoundSummary> = {
  1: { name: "Level 1: Routine Sweeps", teaser: "Basic hygiene checks. Keep your eyes open." },
  2: { name: "Level 2: Closer Look", teaser: "Sometimes the devil is in the details." },
  3: { name: "Level 3: Deep Verification", teaser: "Look deeper. Verification is tricky." },
  4: { name: "Level 4: High Stakes", teaser: "These are crafted to pressure you." },
  5: { name: "Level 5: Master Investigator", teaser: "Only the best spot these." }
};\n\n`;

  // Tutorial
  output += `export const TUTORIAL_STIMULI: Stimulus[] = [
  { id: "t1", type: "SMS", sender: { text: "AX-HDFCBK", isSuspicious: false, explanation: "Valid sender ID format for Indian banks." }, content: { text: "Your A/C XXXXX1234 is credited with INR 5,000.00 on 24-JUN. Info: NEFT/SALARY.", isSuspicious: false, explanation: "Standard transaction format." }, difficultyTier: 1, explanation: "This is a SAFE message. Standard bank notification with a legitimate sender ID format and expected content." },
  { id: "t2", type: "WHATSAPP", sender: { text: "+91 98765 43210", isSuspicious: true, reason: "Fake Sender/Identity", explanation: "Official utilities do not use unverified 10-digit numbers." }, content: { text: "Dear Customer, your electricity service will be disconnected at 9:30 PM today. Please call electricity officer immediately.", isSuspicious: true, reason: "Urgency or Pressure Tactic", explanation: "Creates extreme urgency." }, difficultyTier: 1, explanation: "This is a SCAM attack. Scammers use fake urgency about electricity disconnection to trick you into calling a fake number." },
  { id: "t3", type: "EMAIL", sender: { text: "security@paypal-update-info.com", isSuspicious: true, reason: "Fake Sender/Identity", explanation: "Lookalike domain (typosquatting)." }, content: { text: "We noticed unusual activity on your account. Please verify your identity within 24 hours or your account will be locked.", isSuspicious: true, reason: "Urgency or Pressure Tactic", explanation: "Threatens account closure." }, actionUrl: { text: "http://paypal.verify-secure-login.net", isSuspicious: true, reason: "Suspicious Link or URL", explanation: "Link does not point to paypal.com and lacks HTTPS." }, difficultyTier: 1, explanation: "This is a PHISHING email. It combines fake sender domains, urgency, and a malicious link to steal credentials." }
];\n\n`;

  const safeMarketing = [
    { type: 'EMAIL', sender: 'news@marketing.myntra.com', content: 'The End of Reason Sale is LIVE! Get up to 80% off on top brands.', actionUrl: 'https://www.myntra.com/sale', explanation: 'SAFE. This is a legitimate marketing email. The domain is correct and the URL points to the official site.' },
    { type: 'EMAIL', sender: 'promotions@swiggy.in', content: 'Hungry? Get 50% off your next 3 orders this weekend. Use code WEEKEND50.', actionUrl: 'https://www.swiggy.com', explanation: 'SAFE. Standard marketing promotion from a verified service.' },
    { type: 'SMS', sender: 'JD-DOMINO', content: 'Craving pizza? Buy 1 Get 1 FREE on medium pizzas today! T&C apply.', actionUrl: 'https://pizzaonline.dominos.co.in/', explanation: 'SAFE. Verified promotional SMS sender ID and official link.' },
  ];

  const gameStimuli = [];
  let id = 1;

  const add = (tier, type, sText, sSusp, sReas, cText, cSusp, cReas, uText, uSusp, uReas, aText, aSusp, aReas, expl) => {
    let s = `  { id: "g${id++}", type: "${type}", `;
    s += `sender: { text: ${JSON.stringify(sText)}, isSuspicious: ${sSusp}, ${sReas ? `reason: '${sReas}', ` : ''}explanation: ${JSON.stringify(sSusp ? 'Suspicious sender.' : 'Looks valid.')} }, `;
    s += `content: { text: ${JSON.stringify(cText)}, isSuspicious: ${cSusp}, ${cReas ? `reason: '${cReas}', ` : ''}explanation: ${JSON.stringify(cSusp ? 'Suspicious content.' : 'Standard text.')} }, `;
    if (uText) s += `actionUrl: { text: ${JSON.stringify(uText)}, isSuspicious: ${uSusp}, ${uReas ? `reason: '${uReas}', ` : ''}explanation: ${JSON.stringify(uSusp ? 'Suspicious URL.' : 'Official URL.')} }, `;
    if (aText) s += `amount: { text: ${JSON.stringify(aText)}, isSuspicious: ${aSusp}, ${aReas ? `reason: '${aReas}', ` : ''}explanation: ${JSON.stringify(aSusp ? 'Suspicious amount.' : 'Valid amount.')} }, `;
    s += `difficultyTier: ${tier}, explanation: ${JSON.stringify(expl)} }`;
    gameStimuli.push(s);
  };

  // TIER 1 (10 items) - Obvious scams and normal safe ones
  add(1, 'EMAIL', 'admin@amzon-support.net', true, 'Fake Sender/Identity', 'Your Amazon account is locked due to suspicious login. Verify immediately.', true, 'Urgency or Pressure Tactic', 'http://amzon-login-verify.com', true, 'Suspicious Link or URL', null, false, null, 'PHISHING: Obvious typos in domain and fake urgency.');
  add(1, 'SMS', 'VK-ITDEPT', true, 'Fake Sender/Identity', 'Dear Taxpayer, your IT refund of Rs 15,400 is approved. Click link to claim into bank.', true, 'Request for Sensitive Information', 'http://incometax-gov.in.refund-claim.com', true, 'Suspicious Link or URL', null, false, null, 'SMISHING: Income tax department does not send generic links for refunds via HTTP.');
  add(1, 'WHATSAPP', '+1 (555) 019-2834', true, 'Fake Sender/Identity', 'Congratulations! Your mobile number won $1,000,000 in the international lottery.', true, 'Request for Sensitive Information', null, false, null, null, false, null, 'SCAM: Classic lottery scam from an unknown international number.');
  add(1, 'EMAIL', 'support@netflix.com', false, null, 'Your monthly subscription has been renewed successfully.', false, null, 'https://www.netflix.com/account', false, null, null, false, null, 'SAFE: Legitimate service notification with proper domain.');
  add(1, 'UPI', 'rewards@ybl', true, 'Fake Sender/Identity', 'Google Pay Scratch Card Reward. Enter PIN to receive.', true, 'Request for Sensitive Information', null, false, null, '₹ 1,999', true, 'Request for Sensitive Information', 'UPI SCAM: Entering your PIN will deduct money, not receive it.');
  add(1, 'SOCIAL', 'Apple_Support_Official_', true, 'Impersonation or Fake Branding', 'Hello! We saw your complaint. Kindly DM us your device IMEI and Apple ID password for remote fix.', true, 'Request for Sensitive Information', null, false, null, null, false, null, 'SOCIAL PHISHING: Verified companies will never ask for passwords in DMs.');
  add(1, 'SMS', 'AD-ZOMATO', false, null, 'Your order from Burger King has been delivered. Enjoy your meal!', false, null, null, false, null, null, false, null, 'SAFE: Standard order delivery confirmation SMS.');
  add(1, 'EMAIL', 'noreply@linkedin.com', false, null, 'You appeared in 12 searches this week.', false, null, 'https://www.linkedin.com/feed/', false, null, null, false, null, 'SAFE: Standard automated notification from LinkedIn.');
  add(1, 'WHATSAPP', '+91 88888 77777', true, 'Fake Sender/Identity', 'Part-time job offer! Earn Rs 5000/day by just liking YouTube videos. Message us to join.', true, 'Urgency or Pressure Tactic', 'https://wa.me/message/FAKE', true, 'Suspicious Link or URL', null, false, null, 'JOB SCAM: "Like YouTube videos" is a common task fraud scam.');
  add(1, 'EMAIL', 'newsletter@marketing.myntra.com', false, null, 'The End of Reason Sale is LIVE! Get up to 80% off on top brands.', false, null, 'https://www.myntra.com/sale', false, null, null, false, null, 'SAFE (MARKETING): Legitimate promotional email from official sub-domain.');

  // TIER 2 (10 items) - Slightly better disguised
  add(2, 'EMAIL', 'billing@microsoft-365.com', true, 'Fake Sender/Identity', 'Payment failed for Office 365. Update your credit card now to avoid service interruption.', true, 'Urgency or Pressure Tactic', 'https://update-microsoft-365.com/billing', true, 'Suspicious Link or URL', null, false, null, 'PHISHING: Uses a plausible but fake domain for Microsoft billing.');
  add(2, 'SMS', 'JD-POSTIN', true, 'Fake Sender/Identity', 'India Post: Your package could not be delivered due to missing address details. Update here:', true, 'Urgency or Pressure Tactic', 'https://indiapost.redelivery-hub.com', true, 'Suspicious Link or URL', null, false, null, 'SMISHING: Common package delivery scam with fake domain.');
  add(2, 'WHATSAPP', 'Bank Manager Sharma', true, 'Impersonation or Fake Branding', 'Hi, this is Rahul from HDFC branch. Your KYC is pending and account will be frozen by EOD. Please share Aadhaar photo here.', true, 'Request for Sensitive Information', null, false, null, null, false, null, 'VISHING/IMPERSONATION: Bank managers do not collect KYC documents over personal WhatsApp.');
  add(2, 'UPI', 'refund-IRCTC@sbi', true, 'Fake Sender/Identity', 'Ticket cancellation refund. Accept request to process refund.', true, 'Urgency or Pressure Tactic', null, false, null, '₹ 1,250', true, 'Request for Sensitive Information', 'UPI SCAM: Refunds are automatic and never require the user to accept a collect request.');
  add(2, 'SOCIAL', 'Binance_Airdrop_Bot', true, 'Impersonation or Fake Branding', '🎉 500 USDT Airdrop to the first 1000 users! Connect your wallet to claim.', true, 'Request for Sensitive Information', 'https://binance-airdrop-claim.net', true, 'Suspicious Link or URL', null, false, null, 'CRYPTO SCAM: Phishing link designed to drain crypto wallets.');
  add(2, 'EMAIL', 'security@google.com', false, null, 'New sign-in to your linked account from a Mac device in Mumbai.', false, null, 'https://myaccount.google.com/security', false, null, null, false, null, 'SAFE: Legitimate security alert from Google.');
  add(2, 'SMS', 'VK-JIOINF', false, null, 'Your Jio plan Rs 299 is expiring in 3 days. Click to recharge and avoid interruption.', false, null, 'https://www.jio.com/recharge', false, null, null, false, null, 'SAFE: Valid recharge reminder with official URL.');
  add(2, 'EMAIL', 'promotions@swiggy.in', false, null, 'Hungry? Get 50% off your next 3 orders this weekend. Use code WEEKEND50.', false, null, 'https://www.swiggy.com', false, null, null, false, null, 'SAFE (MARKETING): Legitimate promotion from verified domain.');
  add(2, 'WHATSAPP', 'HR - TechCorp', true, 'Impersonation or Fake Branding', 'Your resume has been shortlisted for Remote Data Entry role. Salary 80k/month. Pay Rs 999 registration fee to proceed.', true, 'Request for Sensitive Information', null, false, null, null, false, null, 'JOB SCAM: Legitimate recruiters do not ask for registration fees.');
  add(2, 'EMAIL', 'no-reply@zoom.us', false, null, 'Please join Zoom meeting in progress.', false, null, 'https://zoom.us/j/123456789', false, null, null, false, null, 'SAFE: Valid meeting invitation.');

  // TIER 3 (10 items) - Tricky ones, BEC, deep typos
  add(3, 'EMAIL', 'ceo@c0mpany.com', true, 'Fake Sender/Identity', 'Are you at your desk? I need you to purchase 5 Apple Gift Cards for a client urgently. Keep it confidential.', true, 'Urgency or Pressure Tactic', null, false, null, null, false, null, 'CEO FRAUD (BEC): Scammer impersonates CEO using a slightly misspelled domain (c0mpany) asking for gift cards.');
  add(3, 'SMS', 'AD-EPFOIN', true, 'Fake Sender/Identity', 'EPFO: Your PF withdrawal of Rs 45,000 is on hold. Update KYC PAN immediately via link below.', true, 'Request for Sensitive Information', 'http://epfo.gov.in.kyc-update.com/login', true, 'Suspicious Link or URL', null, false, null, 'SMISHING: Link is a subdomain of a fake domain, not the real epfo.gov.in.');
  add(3, 'EMAIL', 'invoice@docusign.net', false, null, 'You have a document to review and sign: NDA_Agreement.pdf', false, null, 'https://na3.docusign.net/Member/EmailStart.aspx', false, null, null, false, null, 'SAFE: Legitimate DocuSign email format and link.');
  add(3, 'SOCIAL', 'Recruiter @ Meta', true, 'Impersonation or Fake Branding', 'Hi! We are hiring remote developers. Download our custom chat application from this link to start the interview.', true, 'Urgency or Pressure Tactic', 'https://meta-careers-chat.com/download.exe', true, 'Suspicious Link or URL', null, false, null, 'MALWARE SCAM: Distributing trojan/malware disguised as interview software.');
  add(3, 'WHATSAPP', 'Courier Service', true, 'Fake Sender/Identity', 'Your BlueDart parcel is stuck at customs. Pay customs fee of Rs 45 to release it.', true, 'Urgency or Pressure Tactic', 'https://bluedart-customs-pay.com', true, 'Suspicious Link or URL', null, false, null, 'PHISHING: Low-value fee scam designed to steal credit card details.');
  add(3, 'EMAIL', 'notifications@github.com', false, null, '[GitHub] A new commit was pushed to main branch by user.', false, null, 'https://github.com/org/repo/commits/main', false, null, null, false, null, 'SAFE: Legitimate developer notification.');
  add(3, 'UPI', 'electricity-board@paytm', true, 'Impersonation or Fake Branding', 'Previous month bill pending. Pay to avoid power cut.', true, 'Urgency or Pressure Tactic', null, false, null, '₹ 3,420', true, 'Request for Sensitive Information', 'UPI SCAM: Using a generic sounding VPA to impersonate an official electricity board.');
  add(3, 'EMAIL', 'support@appIe.com', true, 'Fake Sender/Identity', 'Your Apple ID has been locked for security reasons. Restore access now.', true, 'Urgency or Pressure Tactic', 'https://appleid.apple.com.secure-recovery.com', true, 'Suspicious Link or URL', null, false, null, 'PHISHING: Sender domain uses an uppercase "i" instead of "l" (appIe.com).');
  add(3, 'SMS', 'JD-HDFCBK', false, null, 'Your Credit Card ending 9999 statement is generated. Minimum due Rs 500.', false, null, 'https://cards.hdfcbank.com', false, null, null, false, null, 'SAFE: Legitimate credit card statement SMS.');
  add(3, 'EMAIL', 'offers@airtel.in', false, null, 'Exclusive offer: Upgrade to 5G Plus today and get free Netflix mobile subscription.', false, null, 'https://www.airtel.in/5g', false, null, null, false, null, 'SAFE (MARKETING): Legitimate telecom marketing.');

  // TIER 4 (10 items) - Advanced, subtle, cloned
  add(4, 'EMAIL', 'security@facebookmail.com', false, null, 'Did you just sign in? A new login was noticed from Chrome on Windows.', false, null, 'https://facebook.com/login/alerts', false, null, null, false, null, 'SAFE: facebookmail.com is actually the legitimate domain Facebook uses for security emails.');
  add(4, 'EMAIL', 'hr@yourcompany.com', true, 'Impersonation or Fake Branding', 'Annual Leave Policy Update 2024. Please review the attached mandatory changes and acknowledge.', true, 'Urgency or Pressure Tactic', 'https://yourcompany.sharepoint-secure.com/login', true, 'Suspicious Link or URL', null, false, null, 'BEC / CREDENTIAL THEFT: Cloned internal email leading to a fake Microsoft 365 login page.');
  add(4, 'SMS', 'VK-TRAFIN', true, 'Fake Sender/Identity', 'Traffic Challan Alert: Rs 1000 fine issued for vehicle. Pay immediately to avoid court summons.', true, 'Urgency or Pressure Tactic', 'https://echallan.parivahan.gov.in.pay-fine.com', true, 'Suspicious Link or URL', null, false, null, 'SMISHING: Fake e-Challan exploiting fear of legal action, link goes to pay-fine.com.');
  add(4, 'WHATSAPP', '+1 (650) 253-0000', true, 'Fake Sender/Identity', 'WhatsApp Support: Your account has been reported for spam. Reply with the 6-digit code sent to your SMS to verify ownership.', true, 'Request for Sensitive Information', null, false, null, null, false, null, 'ACCOUNT TAKEOVER: Attempting to steal the WhatsApp verification OTP to hijack the account.');
  add(4, 'SOCIAL', 'CEO_Official', true, 'Impersonation or Fake Branding', 'I am locked out of the corporate account. Can you quickly send me the AWS root credentials here?', true, 'Urgency or Pressure Tactic', null, false, null, null, false, null, 'WHALING: Impersonating an executive on a social platform to bypass standard email security protocols.');
  add(4, 'EMAIL', 'receipts@uber.com', false, null, 'Your Friday morning trip with Uber.', false, null, 'https://riders.uber.com/trips', false, null, null, false, null, 'SAFE: Legitimate digital receipt.');
  add(4, 'UPI', 'pm-cares-relief@okaxis', true, 'Impersonation or Fake Branding', 'Donate for disaster relief fund.', true, 'Urgency or Pressure Tactic', null, false, null, '₹ 500', true, 'Request for Sensitive Information', 'UPI SCAM: Exploiting charity using an unofficial VPA.');
  add(4, 'EMAIL', 'no-reply@accounts.google.com', false, null, 'Your password was changed.', false, null, 'https://myaccount.google.com/', false, null, null, false, null, 'SAFE: Genuine Google security alert.');
  add(4, 'SMS', 'AD-PAYTM', true, 'Impersonation or Fake Branding', 'Paytm account blocked! Complete e-KYC within 24h by calling 9876543210 or your balance will be seized.', true, 'Urgency or Pressure Tactic', null, false, null, null, false, null, 'VISHING: Forcing victim to call a scammer to save their wallet balance.');
  add(4, 'EMAIL', 'info@deals.amazon.com', false, null, "Today's deals: Electronics, Fashion, and more.", false, null, 'https://www.amazon.com/deals', false, null, null, false, null, 'SAFE (MARKETING): Legitimate marketing email from Amazon.');

  // TIER 5 (10 items) - Expert level, zero-day vibe, extremely deceptive
  add(5, 'EMAIL', 'billing@awstrack.me', true, 'Fake Sender/Identity', 'AWS Invoice INV-4929348. Payment method declined. Services will be suspended in 1 hour.', true, 'Urgency or Pressure Tactic', 'https://console.aws.amazon.com.login-verify.net/', true, 'Suspicious Link or URL', null, false, null, 'EXPERT PHISHING: Uses a realistic tracking domain and threatens immediate cloud service shutdown to steal AWS root credentials.');
  add(5, 'EMAIL', 'payroll@gusto.com', false, null, 'Your latest paystub is available for viewing.', false, null, 'https://app.gusto.com/login', false, null, null, false, null, 'SAFE: Valid payroll notification.');
  add(5, 'SMS', 'VK-GOVIND', true, 'Impersonation or Fake Branding', 'Dear citizen, you are eligible for Rs 50,000 Govt subsidy. Fill the application form here:', true, 'Request for Sensitive Information', 'https://mygov.in.subsidy-claim.org', true, 'Suspicious Link or URL', null, false, null, 'SMISHING: High-quality fake government scheme scam.');
  add(5, 'WHATSAPP', 'IT Support Desk', true, 'Impersonation or Fake Branding', 'Mandatory VPN update required due to zero-day vulnerability. Install the attached APK to maintain network access.', true, 'Urgency or Pressure Tactic', 'https://corp-vpn-update.com/app.apk', true, 'Suspicious Link or URL', null, false, null, 'MALWARE SCAM: Disguised as critical corporate IT support to distribute malware/spyware.');
  add(5, 'SOCIAL', 'CustomerCare_X', true, 'Impersonation or Fake Branding', 'We detected unauthorized access to your account. We need to verify you. Click here to authenticate via OAuth.', true, 'Urgency or Pressure Tactic', 'https://twitter-auth-secure.com', true, 'Suspicious Link or URL', null, false, null, 'OAUTH PHISHING: Tricking the user into granting account permissions to a malicious app.');
  add(5, 'EMAIL', 'updates@github.com', true, 'Fake Sender/Identity', '[Action Required] Your repository contains a critical vulnerability (CVE-2024-1123). Apply patch immediately.', true, 'Urgency or Pressure Tactic', 'https://github.com.patch-repo.net/login', true, 'Suspicious Link or URL', null, false, null, 'SPEAR PHISHING: Targeting developers with fake security alerts to steal source code access.');
  add(5, 'UPI', 'sbi-card-payment@upi', false, null, 'Credit card bill payment successful.', false, null, null, false, null, '₹ 15,400', false, null, 'SAFE: Legitimate UPI payment confirmation receipt (no collect request).');
  add(5, 'EMAIL', 'marketing@hubspot.com', false, null, 'Learn how to increase your conversion rate by 20% in Q3.', false, null, 'https://blog.hubspot.com/marketing', false, null, null, false, null, 'SAFE (MARKETING): Legitimate B2B marketing content.');
  add(5, 'SMS', 'JD-BAJAJF', true, 'Impersonation or Fake Branding', 'Pre-approved personal loan of Rs 5 Lakhs! Click to sign agreement. Processing fee Rs 1,999 required.', true, 'Request for Sensitive Information', 'https://bajajfinserv-loan-approval.com', true, 'Suspicious Link or URL', null, false, null, 'LOAN SCAM: Advance fee fraud posing as a legitimate NBFC.');
  add(5, 'WHATSAPP', 'Family Member (Unknown Number)', true, 'Impersonation or Fake Branding', 'Hi mom, I dropped my phone and it broke. This is my new number. I urgently need to pay a bill, can you send 5k via UPI?', true, 'Urgency or Pressure Tactic', null, false, null, null, false, null, 'IMPERSONATION: "Hi Mum" scam. Exploits familial trust and urgency to bypass logical thinking.');

  output += `export const GAME_STIMULI: Stimulus[] = [\n${gameStimuli.join(',\n')}\n];\n\n`;
  output += `export function getStimuliForTier(tier: number): Stimulus[] {
  const available = GAME_STIMULI.filter(s => s.difficultyTier === tier);
  const shuffled = [...available].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 5);
}\n`;

  fs.writeFileSync('src/data/stimuli.ts', output);
};

createStimuli();
