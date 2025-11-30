// scripts/theCultureGourmetContract.js
import fs from "fs";
import path from "path";

const dbDir = path.join(process.cwd(), "Database", "CultureGourmet");
const contractsFile = path.join(dbDir, "contracts.txt");
const clientsFile = path.join(dbDir, "clients.txt");
const settingsFile = path.join(dbDir, "settings.txt");

import nodemailer from "nodemailer";
import { Resend } from "resend";

// ---------- low-level helpers ----------

function ensureDbFiles() {
    try {
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        if (!fs.existsSync(contractsFile)) {
            fs.writeFileSync(contractsFile, "[]", "utf8");
        }
        if (!fs.existsSync(clientsFile)) {
            fs.writeFileSync(clientsFile, "[]", "utf8");
        }
        if (!fs.existsSync(settingsFile)) {
            fs.writeFileSync(settingsFile, "{}", "utf8");
        }
    } catch (e) {
        console.error("[CG] ensureDbFiles error:", e);
    }
}

function readJsonSafe(filePath) {
    ensureDbFiles();
    try {
        const raw = fs.readFileSync(filePath, "utf8");
        const trimmed = (raw || "").trim();
        if (!trimmed) return [];
        return JSON.parse(trimmed);
    } catch (e) {
        console.error("[CG] readJsonSafe error for", filePath, e);
        return [];
    }
}

function writeJsonSafe(filePath, data) {
    ensureDbFiles();
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
        return true;
    } catch (e) {
        console.error("[CG] writeJsonSafe error for", filePath, e);
        return false;
    }
}

function nowIso() {
    return new Date().toISOString();
}

function makeId() {
    return (
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 10)
    );
}

// Build the human-readable contract text
function buildContractText(c) {
    return `
CULTURE GOURMET – CATERING AGREEMENT
(One-Page Contract)

This Catering Agreement ("Agreement") is entered into between Culture Gourmet ("Caterer") and the undersigned ${c.clientName || "Client"
        } ("Client") for catering services on the date listed below.

1. EVENT DETAILS
Client Name: ${c.clientName || "____________________________"}
Event Date: ${c.eventDate || "____________________________"}
Event Location: ${c.eventLocation || "____________________________"}
Guest Count: ${c.guestCount || "____________________________"}
Event Start/End Time: ${c.eventTime || "____________________________"}

2. SERVICE AREA
Culture Gourmet provides catering services locally within the DMV and nationwide, subject to travel fees.

3. DEPOSIT & BOOKING POLICY
- A 50% deposit is required to secure the event date.
- The deposit is non-refundable and holds the selected date.
- In cases of inclement weather, the deposit is fully transferable to a new mutually agreed-upon date.

4. CANCELLATION POLICY
If the Client cancels for any reason:
- Payments made are credited in full toward a future event date within 12 months.
- No cash refunds will be provided.

5. RESCHEDULING POLICY
- Rescheduling due to weather or unforeseen circumstances is allowed at no additional cost, pending availability.
- New dates are subject to availability and may incur rate differences on holidays or peak days.

6. PAYMENT TERMS
- Accepted payment methods: Credit Card or Cash.
- All events must be paid in full no later than 14 days prior to the event date.
- If an event is booked within 14 days of the event date, the full invoice amount is due at the time of booking.
- Final payment is non-refundable but fully creditable toward a future date if the event is canceled.

7. ALCOHOL SERVICE (If Applicable)
- Alcohol service is provided only to guests 21+.
- Culture Gourmet is not responsible for guest behavior related to alcohol.
- Client agrees to maintain compliance with all state and local alcohol laws.

8. LIABILITY & DAMAGES
Client is responsible for any damages to equipment, rentals, or property caused by guests. Culture Gourmet is not liable for circumstances outside of its control, including venue limitations, acts of nature, or client-provided items.

9. AGREEMENT & SIGNATURES
By signing below, the Client acknowledges and agrees to all terms outlined.

Client Name: ${c.clientName || "____________________________"}
Client Signature: ________________________________
Date: ____________________

Culture Gourmet Representative: ______________________________
Signature: _____________________________________
Date: ____________________

Status: ${c.status}
  `.trim();
}

// ---------- actions ----------

async function createContract(payload) {
    const contracts = readJsonSafe(contractsFile);

    const {
        clientName,
        clientEmail,
        eventDate,
        eventLocation,
        guestCount,
        eventTime,
    } = payload;

    const id = makeId();
    const base = {
        id,
        clientName: clientName || "",
        clientEmail: clientEmail || "",
        eventDate: eventDate || "",
        eventLocation: eventLocation || "",
        guestCount: guestCount || "",
        eventTime: eventTime || "",
        status: "Draft",
        fileUrl: "",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        timeline: [
            { at: nowIso(), type: "created", note: "Contract created" },
        ],
    };

    base.contractText = buildContractText(base);

    contracts.push(base);
    writeJsonSafe(contractsFile, contracts);

    return { success: true, contract: base, contracts };
}

async function listContracts() {
    const contracts = readJsonSafe(contractsFile);
    return { success: true, contracts };
}

async function createClient(payload) {
    const { name, contacts } = payload;
    const clients = readJsonSafe(clientsFile);

    const id = makeId();
    
    // Handle the new contacts array format
    const contactsArray = contacts || [];
    
    // For backward compatibility, set primary email/phone from first contact
    const primaryEmail = contactsArray.length > 0 ? (contactsArray[0].email || "") : "";
    const primaryPhone = contactsArray.length > 0 ? (contactsArray[0].phone || "") : "";

    const client = {
        id,
        name: name || "",
        email: primaryEmail,
        phone: primaryPhone,
        contacts: contactsArray,
        contactsCount: contactsArray.length,
        createdAt: nowIso(),
    };

    clients.push(client);
    writeJsonSafe(clientsFile, clients);

    return { success: true, client };
}

async function listClients() {
    const clients = readJsonSafe(clientsFile);
    return { success: true, clients };
}

async function updateClient(payload) {
    const { clientId, name, contacts } = payload;
    const clients = readJsonSafe(clientsFile);
    const idx = clients.findIndex((c) => c.id === clientId);

    if (idx === -1) {
        return { success: false, message: "Client not found" };
    }

    const client = clients[idx];

    if (name !== undefined) client.name = name;
    
    // Handle the new contacts array format
    if (contacts !== undefined) {
        client.contacts = contacts;
        client.contactsCount = contacts.length;
        
        // For backward compatibility, also set the first contact as primary email/phone
        if (contacts.length > 0) {
            const primaryContact = contacts[0];
            client.email = primaryContact.email || "";
            client.phone = primaryContact.phone || "";
        }
    }

    client.updatedAt = nowIso();
    clients[idx] = client;
    writeJsonSafe(clientsFile, clients);

    return { success: true, client };
}

async function deleteClient(payload) {
    const { clientId } = payload;
    const clients = readJsonSafe(clientsFile);
    const idx = clients.findIndex((c) => c.id === clientId);

    if (idx === -1) {
        return { success: false, message: "Client not found" };
    }

    clients.splice(idx, 1);
    writeJsonSafe(clientsFile, clients);

    return { success: true };
}

// Get default settings from environment variables
function getDefaultSettings() {
    const defaults = {
        resendApiKey: process.env.CG_RESEND_API_KEY || "",
        resendFromEmail: process.env.CG_RESEND_FROM_EMAIL || "onboarding@resend.dev",
        smtpHost: process.env.CG_SMTP_HOST || "",
        smtpPort: process.env.CG_SMTP_PORT || "587",
        smtpUser: process.env.CG_SMTP_USER || "",
        smtpPass: process.env.CG_SMTP_PASS || "",
        smtpFrom: process.env.CG_SMTP_FROM || ""
    };
    console.log('[CG] Environment check - CG_RESEND_API_KEY:', process.env.CG_RESEND_API_KEY ? 'SET' : 'NOT SET');
    return defaults;
}

async function getSettings() {
    let fileSettings = readJsonSafe(settingsFile);
    const defaults = getDefaultSettings();
    
    // ENV VARIABLES TAKE PRIORITY over file settings
    const settings = {
        resendApiKey: defaults.resendApiKey || fileSettings.resendApiKey,
        resendFromEmail: defaults.resendFromEmail || fileSettings.resendFromEmail,
        smtpHost: defaults.smtpHost || fileSettings.smtpHost,
        smtpPort: defaults.smtpPort || fileSettings.smtpPort,
        smtpUser: defaults.smtpUser || fileSettings.smtpUser,
        smtpPass: defaults.smtpPass || fileSettings.smtpPass,
        smtpFrom: defaults.smtpFrom || fileSettings.smtpFrom
    };
    
    return { success: true, settings };
}

async function saveSettings(payload) {
    const { resendApiKey, resendFromEmail, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom } = payload;
    const settings = { resendApiKey, resendFromEmail, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom };
    writeJsonSafe(settingsFile, settings);
    return { success: true, settings };
}

async function sendContract(payload) {
    try {
        console.log('[CG] sendContract called with payload:', JSON.stringify(payload));
        const { contractId } = payload;
        const contracts = readJsonSafe(contractsFile);
        const idx = contracts.findIndex((c) => c.id === contractId);

        if (idx === -1) {
        return { success: false, message: "Contract not found" };
    }

    const contract = contracts[idx];

    // Point to the new HTML view
    contract.fileUrl = `/clients/contract-view.html?contractId=${contract.id}`;

    // Try to send email - ENV VARIABLES TAKE PRIORITY over file settings
    const fileSettings = readJsonSafe(settingsFile);
    const defaults = getDefaultSettings();
    const settings = {
        // Environment variables first, then file settings, then defaults
        resendApiKey: defaults.resendApiKey || fileSettings.resendApiKey,
        resendFromEmail: defaults.resendFromEmail || fileSettings.resendFromEmail,
        smtpHost: defaults.smtpHost || fileSettings.smtpHost,
        smtpPort: defaults.smtpPort || fileSettings.smtpPort,
        smtpUser: defaults.smtpUser || fileSettings.smtpUser,
        smtpPass: defaults.smtpPass || fileSettings.smtpPass,
        smtpFrom: defaults.smtpFrom || fileSettings.smtpFrom
    };
    console.log('[CG] Using Resend from email:', settings.resendFromEmail);
    console.log('[CG] Using settings - Resend:', settings.resendApiKey ? 'configured' : 'not configured', ', SMTP:', settings.smtpHost ? 'configured' : 'not configured');
    
    let emailSent = false;
    let emailError = null;
    
    const fullLink = `https://backend.aivisualpro.com/clients/contract-view.html?contractId=${contract.id}`;
    console.log('[CG] Contract Link being sent:', fullLink);

    const fromName = settings.smtpFrom || "Culture Gourmet";
    const fromEmail = settings.smtpUser || "noreply@aivisualpro.com";

    // Beautiful HTML email template
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden;">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Culture Gourmet</h1>
                            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Premium Catering Services</p>
                        </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px; color: #1a1a2e; font-size: 22px; font-weight: 600;">Hello ${contract.clientName}! 👋</h2>
                            
                            <p style="margin: 0 0 24px; color: #4a4a68; font-size: 16px; line-height: 1.6;">
                                Thank you for choosing Culture Gourmet for your upcoming event. Your catering agreement is ready for review and signature.
                            </p>
                            
                            <!-- Event Details Card -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f9fc; border-radius: 12px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <p style="margin: 0 0 12px; color: #667eea; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Event Details</p>
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Event Date:</td>
                                                <td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 500; text-align: right;">${contract.eventDate || 'To be confirmed'}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Location:</td>
                                                <td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 500; text-align: right;">${contract.eventLocation || 'To be confirmed'}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Guest Count:</td>
                                                <td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 500; text-align: right;">${contract.guestCount || 'To be confirmed'}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 30px;">
                                        <a href="${fullLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: all 0.3s;">
                                            ✍️ View & Sign Contract
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 0; color: #9ca3af; font-size: 13px; text-align: center; line-height: 1.5;">
                                If the button doesn't work, copy and paste this link into your browser:<br>
                                <a href="${fullLink}" style="color: #667eea; word-break: break-all;">${fullLink}</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fc; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 8px; color: #1a1a2e; font-size: 14px; font-weight: 600;">Culture Gourmet</p>
                            <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px;">Elevating Your Events with Exceptional Cuisine</p>
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                © ${new Date().getFullYear()} Culture Gourmet. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

    const emailText = `Hello ${contract.clientName},

Thank you for choosing Culture Gourmet for your upcoming event. Your catering agreement is ready for review and signature.

Event Details:
- Event Date: ${contract.eventDate || 'To be confirmed'}
- Location: ${contract.eventLocation || 'To be confirmed'}
- Guest Count: ${contract.guestCount || 'To be confirmed'}

View & Sign Your Contract:
${fullLink}

Thank you,
Culture Gourmet
Elevating Your Events with Exceptional Cuisine`;

    // Method 1: Try Resend API first (works on Render and other cloud providers)
    if (settings.resendApiKey && !emailSent) {
        try {
            console.log('[CG] Trying Resend API...');
            const resend = new Resend(settings.resendApiKey);
            
            const { data, error } = await resend.emails.send({
                from: `${fromName} <${settings.resendFromEmail || 'onboarding@resend.dev'}>`,
                to: [contract.clientEmail],
                subject: "🍽️ Your Culture Gourmet Catering Agreement",
                text: emailText,
                html: emailHtml,
            });

            if (error) {
                console.error('[CG] Resend API Error:', error);
                emailError = error.message || JSON.stringify(error);
            } else {
                emailSent = true;
                console.log('[CG] Email sent successfully via Resend! ID:', data?.id);
            }
        } catch (err) {
            console.error('[CG] Resend Error:', err.message);
            emailError = err.message;
        }
    }

    // Method 2: Fall back to SMTP (works on localhost)
    if (settings.smtpHost && settings.smtpUser && settings.smtpPass && !emailSent) {
        const portsToTry = [
            parseInt(settings.smtpPort || "587"),
            2525, 587, 465
        ];
        const uniquePorts = [...new Set(portsToTry)];

        const fromAddress = settings.smtpFrom
            ? (settings.smtpFrom.includes('@') ? settings.smtpFrom : `${settings.smtpFrom} <${settings.smtpUser}>`)
            : settings.smtpUser;

        for (const port of uniquePorts) {
            if (emailSent) break;
            
            try {
                console.log(`[CG] Trying SMTP on port ${port}...`);
                const transporter = nodemailer.createTransport({
                    host: settings.smtpHost,
                    port: port,
                    secure: port === 465,
                    connectionTimeout: 10000,
                    greetingTimeout: 10000,
                    auth: {
                        user: settings.smtpUser,
                        pass: settings.smtpPass,
                    },
                });

                console.log('[CG] From:', fromAddress);
                console.log('[CG] To:', contract.clientEmail);

                await transporter.sendMail({
                    from: fromAddress,
                    to: contract.clientEmail,
                    subject: "🍽️ Your Culture Gourmet Catering Agreement",
                    text: emailText,
                    html: emailHtml,
                });
                emailSent = true;
                console.log(`[CG] Email sent successfully via SMTP on port ${port}!`);
            } catch (err) {
                console.error(`[CG] SMTP Error on port ${port}:`, err.message);
                emailError = err.message;
            }
        }
        
        if (!emailSent) {
            console.error("[CG] All SMTP ports failed. Last error:", emailError);
        }
    }

    contract.status = "Sent";
    contract.updatedAt = nowIso();
    contract.timeline = contract.timeline || [];
    contract.timeline.push({
        at: nowIso(),
        type: "sent",
        note: emailSent ? "Contract sent via email" : "Contract link generated (email not sent)",
    });

    contract.contractText = buildContractText(contract);
    contracts[idx] = contract;
    writeJsonSafe(contractsFile, contracts);

    console.log('[CG] sendContract completed successfully');
    return { success: true, contract, emailSent, emailError };
    } catch (err) {
        console.error('[CG] sendContract FATAL ERROR:', err);
        console.error('[CG] Error stack:', err.stack);
        return { success: false, message: 'Server error: ' + err.message };
    }
}

async function getContract(payload) {
    const { contractId } = payload;
    const contracts = readJsonSafe(contractsFile);
    const contract = contracts.find((c) => c.id === contractId);

    if (!contract) {
        return { success: false, message: "Contract not found" };
    }

    return { success: true, contract };
}

async function signContract(payload) {
    const { contractId, clientSignature, clientName } = payload;
    const contracts = readJsonSafe(contractsFile);
    const idx = contracts.findIndex((c) => c.id === contractId);

    if (idx === -1) {
        return { success: false, message: "Contract not found" };
    }

    const contract = contracts[idx];
    contract.status = "Signed";
    contract.clientSignature = clientSignature;
    // ensure client name matches signature if needed, or just update it
    if (clientName) contract.clientName = clientName;

    contract.signedAt = nowIso();
    contract.updatedAt = nowIso();
    contract.timeline = contract.timeline || [];
    contract.timeline.push({
        at: nowIso(),
        type: "signed",
        note: `Contract signed by ${clientName || "Client"}`,
    });

    contract.contractText = buildContractText(contract);
    contracts[idx] = contract;
    writeJsonSafe(contractsFile, contracts);

    return { success: true, contract };
}

async function updateContractStatus(payload) {
    const { contractId, status } = payload;
    const contracts = readJsonSafe(contractsFile);
    const idx = contracts.findIndex((c) => c.id === contractId);

    if (idx === -1) {
        return { success: false, message: "Contract not found" };
    }

    const contract = contracts[idx];
    contract.status = status || contract.status;
    contract.updatedAt = nowIso();
    contract.timeline = contract.timeline || [];
    contract.timeline.push({
        at: nowIso(),
        type: "status",
        note: `Status changed to ${contract.status}`,
    });

    contract.contractText = buildContractText(contract);
    contracts[idx] = contract;
    writeJsonSafe(contractsFile, contracts);

    return { success: true, contract };
}

async function updateContractFields(payload) {
    const {
        contractId,
        clientName,
        clientEmail,
        eventDate,
        eventLocation,
        guestCount,
        eventTime,
    } = payload;

    const contracts = readJsonSafe(contractsFile);
    const idx = contracts.findIndex((c) => c.id === contractId);

    if (idx === -1) {
        return { success: false, message: "Contract not found" };
    }

    const contract = contracts[idx];

    if (clientName !== undefined) contract.clientName = clientName;
    if (clientEmail !== undefined) contract.clientEmail = clientEmail;
    if (eventDate !== undefined) contract.eventDate = eventDate;
    if (eventLocation !== undefined) contract.eventLocation = eventLocation;
    if (guestCount !== undefined) contract.guestCount = guestCount;
    if (eventTime !== undefined) contract.eventTime = eventTime;

    contract.updatedAt = nowIso();
    contract.timeline = contract.timeline || [];
    contract.timeline.push({
        at: nowIso(),
        type: "edited",
        note: "Contract details updated",
    });

    contract.contractText = buildContractText(contract);
    contracts[idx] = contract;
    writeJsonSafe(contractsFile, contracts);

    return { success: true, contract };
}

async function deleteContract(payload) {
    const { contractId } = payload;
    const contracts = readJsonSafe(contractsFile);
    const idx = contracts.findIndex((c) => c.id === contractId);

    if (idx === -1) {
        return { success: false, message: "Contract not found" };
    }

    contracts.splice(idx, 1);
    writeJsonSafe(contractsFile, contracts);

    return { success: true, removedId: contractId };
}

// ---------- main handler (used by server.js) ----------

export default async function theCultureGourmetContract(payload = {}) {
    try {
        console.log("[CG] incoming:", JSON.stringify(payload));

        const action = payload.action;

        if (!action) {
            return { success: false, message: "Missing action in payload" };
        }

        switch (action) {
            case "create":
            case "createContract":
                return await createContract(payload);
            case "listContracts":
                return await listContracts();
            case "createClient":
                return await createClient(payload);
            case "listClients":
                return await listClients();
            case "updateClient":
                return await updateClient(payload);
            case "deleteClient":
                return await deleteClient(payload);
            case "sendContract":
                return await sendContract(payload);
            case "getSettings":
                return await getSettings();
            case "saveSettings":
                return await saveSettings(payload);
            case "getContract":
                return await getContract(payload);
            case "signContract":
                return await signContract(payload);
            case "updateContractStatus":
                return await updateContractStatus(payload);
            case "updateContractFields":
                return await updateContractFields(payload);
            case "deleteContract":
                return await deleteContract(payload);
            default:
                console.warn("[CG] Unknown action:", action);
                return { success: false, message: `Unknown action: ${action}` };
        }
    } catch (err) {
        console.error("[CG] Fatal error in handler:", err);
        // important: we RETURN an object, not throw → avoids 500 from here
        return { success: false, message: "Internal error in webhook script." };
    }
}
