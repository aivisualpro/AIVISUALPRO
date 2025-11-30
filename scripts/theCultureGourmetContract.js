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

async function getSettings() {
    const settings = readJsonSafe(settingsFile);
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

    // Try to send email
    const settings = readJsonSafe(settingsFile);
    let emailSent = false;
    let emailError = null;
    
    const fullLink = `https://backend.aivisualpro.com/clients/contract-view.html?contractId=${contract.id}`;
    console.log('[CG] Contract Link being sent:', fullLink);

    const fromName = settings.smtpFrom || "Culture Gourmet";
    const fromEmail = settings.smtpUser || "noreply@aivisualpro.com";

    // Method 1: Try Resend API first (works on Render and other cloud providers)
    if (settings.resendApiKey && !emailSent) {
        try {
            console.log('[CG] Trying Resend API...');
            const resend = new Resend(settings.resendApiKey);
            
            const { data, error } = await resend.emails.send({
                from: `${fromName} <${settings.resendFromEmail || 'onboarding@resend.dev'}>`,
                to: [contract.clientEmail],
                subject: "Culture Gourmet Catering Agreement",
                text: `Hi ${contract.clientName},\n\nHere is your catering agreement:\n${fullLink}\n\nThank you,\nCulture Gourmet`,
                html: `<p>Hi ${contract.clientName},</p><p>Here is your catering agreement:</p><p><a href="${fullLink}">View & Sign Contract</a></p><p>Thank you,<br>Culture Gourmet</p>`,
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
                    subject: "Culture Gourmet Catering Agreement",
                    text: `Hi ${contract.clientName},\n\nHere is your catering agreement:\n${fullLink}\n\nThank you,\nCulture Gourmet`,
                    html: `<p>Hi ${contract.clientName},</p><p>Here is your catering agreement:</p><p><a href="${fullLink}">View & Sign Contract</a></p><p>Thank you,<br>Culture Gourmet</p>`,
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
