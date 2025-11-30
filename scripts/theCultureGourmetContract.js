// scripts/theCultureGourmetContract.js
// MongoDB version - Culture Gourmet Contract Management

import { MongoClient } from "mongodb";
import { Resend } from "resend";

// MongoDB Connection
const MONGODB_URI = process.env.THECULTUREGOURMETMONGODB_URI;
let client = null;
let db = null;

async function getDb() {
    if (db) return db;
    
    if (!MONGODB_URI) {
        throw new Error("THECULTUREGOURMETMONGODB_URI environment variable not set");
    }
    
    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(); // Uses database from connection string
        console.log("[CG] Connected to MongoDB");
        return db;
    } catch (err) {
        console.error("[CG] MongoDB connection error:", err);
        throw err;
    }
}

// Collections
async function getContractsCollection() {
    const database = await getDb();
    return database.collection("contracts");
}

async function getClientsCollection() {
    const database = await getDb();
    return database.collection("clients");
}

async function getSettingsCollection() {
    const database = await getDb();
    return database.collection("settings");
}

async function getTemplatesCollection() {
    const database = await getDb();
    return database.collection("templates");
}

// ---------- Helpers ----------

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

// Replace template variables with actual values
function replaceTemplateVariables(templateBody, contractData, companySettings = {}) {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    const variables = {
        '{{clientName}}': contractData.clientName || '____________________________',
        '{{clientEmail}}': contractData.clientEmail || '____________________________',
        '{{eventDate}}': contractData.eventDate || '____________________________',
        '{{eventLocation}}': contractData.eventLocation || '____________________________',
        '{{guestCount}}': contractData.guestCount || '____________________________',
        '{{eventTime}}': contractData.eventTime || '____________________________',
        '{{companyName}}': companySettings.companyName || 'Culture Gourmet',
        '{{repName}}': companySettings.repName || '____________________________',
        '{{todayDate}}': today,
    };
    
    let result = templateBody;
    for (const [key, value] of Object.entries(variables)) {
        result = result.split(key).join(value);
    }
    
    return result;
}

// Build the human-readable contract text from template (template required)
async function buildContractTextFromTemplate(c, companySettings = {}, templateId = null) {
    const templatesCollection = await getTemplatesCollection();
    
    // Try to get the specified template
    let template = null;
    if (templateId) {
        template = await templatesCollection.findOne({ id: templateId });
    }
    
    // Fall back to default template if specified template not found
    if (!template) {
        template = await templatesCollection.findOne({ isDefault: true });
    }
    
    // Fall back to any template
    if (!template) {
        template = await templatesCollection.findOne({});
    }
    
    // Template is required - return error message if none found
    if (!template || !template.body) {
        return "ERROR: No contract template found. Please create a template first.";
    }
    
    // Increment usage count
    await templatesCollection.updateOne(
        { id: template.id },
        { $inc: { usageCount: 1 } }
    );
    
    return replaceTemplateVariables(template.body, c, companySettings);
}

// ---------- Contract Actions ----------

async function createContract(payload) {
    const collection = await getContractsCollection();

    const {
        clientName,
        clientEmail,
        eventDate,
        eventLocation,
        guestCount,
        eventTime,
        templateId,
    } = payload;

    // Template is now required for new contracts
    if (!templateId) {
        return { success: false, message: "Please select a contract template." };
    }

    // Get company settings for contract text
    const companySettingsResult = await getCompanySettings();
    const companySettings = companySettingsResult.settings || {};

    const id = makeId();
    const contract = {
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
        // Store company settings snapshot with contract
        companyName: companySettings.companyName || "Culture Gourmet",
        repName: companySettings.repName || "",
        repSignature: companySettings.repSignature || "",
        templateId: templateId || null,
        timeline: [
            { at: nowIso(), type: "created", note: "Contract created" },
        ],
    };

    // Use template-based contract text if available
    contract.contractText = await buildContractTextFromTemplate(contract, companySettings, templateId);

    await collection.insertOne(contract);
    
    // Return all contracts for UI update
    const contracts = await collection.find({}).sort({ createdAt: -1 }).toArray();

    return { success: true, contract, contracts };
}

async function listContracts() {
    const collection = await getContractsCollection();
    const contracts = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return { success: true, contracts };
}

async function getContract(payload) {
    const { contractId } = payload;
    const collection = await getContractsCollection();
    const contract = await collection.findOne({ id: contractId });

    if (!contract) {
        return { success: false, message: "Contract not found" };
    }

    return { success: true, contract };
}

// Mark contract as viewed (Under Review) when client opens the link
async function markAsViewed(payload) {
    const { contractId } = payload;
    const collection = await getContractsCollection();
    const contract = await collection.findOne({ id: contractId });

    if (!contract) {
        return { success: false, message: "Contract not found" };
    }

    // Only mark as viewed if status is "Sent" (not already viewed or signed)
    if (contract.status === "Sent") {
        const timeline = contract.timeline || [];
        timeline.push({
            at: nowIso(),
            type: "viewed",
            label: "Under Review",
            note: "Client opened the contract"
        });

        await collection.updateOne(
            { id: contractId },
            {
                $set: {
                    status: "Under Review",
                    viewedAt: nowIso(),
                    updatedAt: nowIso(),
                    timeline: timeline
                }
            }
        );

        const updatedContract = await collection.findOne({ id: contractId });
        return { success: true, contract: updatedContract };
    }

    return { success: true, contract, message: "Already viewed or signed" };
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

    const collection = await getContractsCollection();
    const contract = await collection.findOne({ id: contractId });

    if (!contract) {
        return { success: false, message: "Contract not found" };
    }

    const updates = {};
    if (clientName !== undefined) updates.clientName = clientName;
    if (clientEmail !== undefined) updates.clientEmail = clientEmail;
    if (eventDate !== undefined) updates.eventDate = eventDate;
    if (eventLocation !== undefined) updates.eventLocation = eventLocation;
    if (guestCount !== undefined) updates.guestCount = guestCount;
    if (eventTime !== undefined) updates.eventTime = eventTime;

    updates.updatedAt = nowIso();
    
    // Merge with existing contract to rebuild text using template
    const updatedContract = { ...contract, ...updates };
    const companySettings = await getCompanySettings();
    updates.contractText = await buildContractTextFromTemplate(updatedContract, companySettings, contract.templateId);
    
    // Add timeline entry
    const timelineEntry = {
        at: nowIso(),
        type: "edited",
        note: "Contract details updated",
    };

    await collection.updateOne(
        { id: contractId },
        { 
            $set: updates,
            $push: { timeline: timelineEntry }
        }
    );

    const result = await collection.findOne({ id: contractId });
    return { success: true, contract: result };
}

async function updateContractStatus(payload) {
    const { contractId, status } = payload;
    const collection = await getContractsCollection();
    const contract = await collection.findOne({ id: contractId });

    if (!contract) {
        return { success: false, message: "Contract not found" };
    }

    const timelineEntry = {
        at: nowIso(),
        type: "status",
        note: `Status changed to ${status}`,
    };

    await collection.updateOne(
        { id: contractId },
        { 
            $set: { 
                status, 
                updatedAt: nowIso()
            },
            $push: { timeline: timelineEntry }
        }
    );

    const result = await collection.findOne({ id: contractId });
    return { success: true, contract: result };
}

async function deleteContract(payload) {
    const { contractId } = payload;
    const collection = await getContractsCollection();
    
    const result = await collection.deleteOne({ id: contractId });

    if (result.deletedCount === 0) {
        return { success: false, message: "Contract not found" };
    }

    return { success: true, removedId: contractId };
}

async function signContract(payload) {
    const { contractId, clientSignature, clientName } = payload;
    const collection = await getContractsCollection();
    const contract = await collection.findOne({ id: contractId });

    if (!contract) {
        return { success: false, message: "Contract not found" };
    }

    const timelineEntry = {
        at: nowIso(),
        type: "signed",
        note: `Contract signed by ${clientName || "Client"}`,
    };

    const updates = {
        status: "Signed",
        clientSignature,
        signedAt: nowIso(),
        updatedAt: nowIso(),
    };
    
    if (clientName) updates.clientName = clientName;

    await collection.updateOne(
        { id: contractId },
        { 
            $set: updates,
            $push: { timeline: timelineEntry }
        }
    );

    const result = await collection.findOne({ id: contractId });
    return { success: true, contract: result };
}

// ---------- Client Actions ----------

async function createClient(payload) {
    const { name, contacts } = payload;
    const collection = await getClientsCollection();

    const id = makeId();
    const contactsArray = contacts || [];
    
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

    await collection.insertOne(client);

    return { success: true, client };
}

async function listClients() {
    const collection = await getClientsCollection();
    const clients = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return { success: true, clients };
}

async function updateClient(payload) {
    const { clientId, name, contacts } = payload;
    const collection = await getClientsCollection();
    const client = await collection.findOne({ id: clientId });

    if (!client) {
        return { success: false, message: "Client not found" };
    }

    const updates = { updatedAt: nowIso() };

    if (name !== undefined) updates.name = name;
    
    if (contacts !== undefined) {
        updates.contacts = contacts;
        updates.contactsCount = contacts.length;
        
        if (contacts.length > 0) {
            const primaryContact = contacts[0];
            updates.email = primaryContact.email || "";
            updates.phone = primaryContact.phone || "";
        }
    }

    await collection.updateOne({ id: clientId }, { $set: updates });

    const result = await collection.findOne({ id: clientId });
    return { success: true, client: result };
}

async function deleteClient(payload) {
    const { clientId } = payload;
    const collection = await getClientsCollection();
    
    const result = await collection.deleteOne({ id: clientId });

    if (result.deletedCount === 0) {
        return { success: false, message: "Client not found" };
    }

    return { success: true };
}

// ---------- Settings ----------

function getDefaultSettings() {
    const defaults = {
        resendApiKey: process.env.CG_RESEND_API_KEY || "",
        resendFromEmail: process.env.CG_RESEND_FROM_EMAIL || "onboarding@resend.dev",
    };
    console.log('[CG] Environment check - CG_RESEND_API_KEY:', process.env.CG_RESEND_API_KEY ? 'SET' : 'NOT SET');
    return defaults;
}

async function getSettings() {
    const collection = await getSettingsCollection();
    let dbSettings = await collection.findOne({ type: "email" }) || {};
    const defaults = getDefaultSettings();
    
    const settings = {
        resendApiKey: defaults.resendApiKey || dbSettings.resendApiKey,
        resendFromEmail: defaults.resendFromEmail || dbSettings.resendFromEmail,
        
    };
    
    return { success: true, settings };
}

async function saveSettings(payload) {
    const { resendApiKey, resendFromEmail } = payload;
    const collection = await getSettingsCollection();
    
    const settings = { 
        type: "email",
        resendApiKey, 
        resendFromEmail,
        updatedAt: nowIso()
    };
    
    await collection.updateOne(
        { type: "email" },
        { $set: settings },
        { upsert: true }
    );
    
    return { success: true, settings };
}

// ---------- Company Settings ----------

async function getCompanySettings() {
    const collection = await getSettingsCollection();
    const dbSettings = await collection.findOne({ type: "company" }) || {};
    
    return { 
        success: true, 
        settings: {
            companyName: dbSettings.companyName || "Culture Gourmet",
            companyAddress: dbSettings.companyAddress || "",
            repName: dbSettings.repName || "",
            repSignature: dbSettings.repSignature || ""
        }
    };
}

async function saveCompanySettings(payload) {
    const { companyName, companyAddress, repName, repSignature } = payload;
    const collection = await getSettingsCollection();
    
    const settings = { 
        type: "company",
        companyName: companyName || "Culture Gourmet",
        companyAddress: companyAddress || "",
        repName: repName || "",
        repSignature: repSignature || "",
        updatedAt: nowIso()
    };
    
    await collection.updateOne(
        { type: "company" },
        { $set: settings },
        { upsert: true }
    );
    
    return { success: true, settings };
}

// ---------- Email Functions ----------

async function getEmailSettings() {
    const collection = await getSettingsCollection();
    const dbSettings = await collection.findOne({ type: "email" }) || {};
    const defaults = getDefaultSettings();
    
    return {
        resendApiKey: defaults.resendApiKey || dbSettings.resendApiKey,
        resendFromEmail: defaults.resendFromEmail || dbSettings.resendFromEmail,
        
    };
}

async function sendContract(payload) {
    try {
        console.log('[CG] sendContract called with payload:', JSON.stringify(payload));
        const { contractId } = payload;
        const collection = await getContractsCollection();
        const contract = await collection.findOne({ id: contractId });

        if (!contract) {
            return { success: false, message: "Contract not found" };
        }

        contract.fileUrl = `/clients/contract-view.html?contractId=${contract.id}`;

        const settings = await getEmailSettings();
        console.log('[CG] Using Resend from email:', settings.resendFromEmail);
        console.log('[CG] Using settings - Resend:', settings.resendApiKey ? 'configured' : 'not configured');
        
        let emailSent = false;
        let emailError = null;
        
        const fullLink = `https://backend.aivisualpro.com/clients/contract-view.html?contractId=${contract.id}`;
        console.log('[CG] Contract Link being sent:', fullLink);

        const fromName = "Culture Gourmet";

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

        // Method 1: Try Resend API first
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

        // Update contract in MongoDB
        const timelineEntry = {
            at: nowIso(),
            type: "sent",
            note: emailSent ? "Contract sent via email" : "Contract link generated (email not sent)",
        };

        await collection.updateOne(
            { id: contractId },
            { 
                $set: { 
                    status: "Sent",
                    fileUrl: contract.fileUrl,
                    updatedAt: nowIso()
                },
                $push: { timeline: timelineEntry }
            }
        );

        const result = await collection.findOne({ id: contractId });

        console.log('[CG] sendContract completed successfully');
        return { success: true, contract: result, emailSent, emailError };
    } catch (err) {
        console.error('[CG] sendContract FATAL ERROR:', err);
        console.error('[CG] Error stack:', err.stack);
        return { success: false, message: 'Server error: ' + err.message };
    }
}

async function sendSignedCopy(payload) {
    try {
        console.log('[CG] sendSignedCopy called with payload:', JSON.stringify(payload));
        const { contractId } = payload;
        const collection = await getContractsCollection();
        const contract = await collection.findOne({ id: contractId });

        if (!contract) {
            return { success: false, message: "Contract not found" };
        }

        if (contract.status !== "Signed") {
            return { success: false, message: "Contract is not signed yet" };
        }

        const settings = await getEmailSettings();

        const fromName = "Culture Gourmet";
        const fullLink = `https://backend.aivisualpro.com/clients/contract-view.html?contractId=${contract.id}`;
        const signedDate = new Date(contract.signedAt || contract.updatedAt);
        const formattedDate = signedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // Beautiful HTML email template for signed contract
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
                    <!-- Header with Success -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 40px 30px; text-align: center;">
                            <div style="width: 70px; height: 70px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                                <span style="font-size: 32px; color: white;">✓</span>
                            </div>
                            <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 600;">Contract Signed!</h1>
                            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Your signed copy is ready</p>
                        </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px; color: #1a1a2e; font-size: 20px; font-weight: 600;">Hello ${contract.clientName}! 🎉</h2>
                            
                            <p style="margin: 0 0 24px; color: #4a4a68; font-size: 16px; line-height: 1.6;">
                                Congratulations! Your catering agreement has been successfully signed. Below is a copy for your records.
                            </p>
                            
                            <!-- Contract Summary Card -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f9fc; border-radius: 12px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <p style="margin: 0 0 12px; color: #10b981; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">✓ Signed Contract Summary</p>
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
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Signed On:</td>
                                                <td style="padding: 8px 0; color: #10b981; font-size: 14px; font-weight: 600; text-align: right;">${formattedDate}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Signature Display -->
                            ${contract.clientSignature && contract.clientSignature.startsWith('data:image') ? `
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; margin-bottom: 30px; border: 2px solid #86efac;">
                                <tr>
                                    <td style="padding: 24px; text-align: center;">
                                        <p style="margin: 0 0 12px; color: #166534; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your Signature</p>
                                        <img src="${contract.clientSignature}" alt="Your Signature" style="max-width: 200px; max-height: 60px; border-bottom: 2px solid #1a1a2e; padding-bottom: 8px;" />
                                        <p style="margin: 10px 0 0; color: #374151; font-size: 13px;">${contract.clientName}</p>
                                    </td>
                                </tr>
                            </table>
                            ` : ''}
                            
                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 30px;">
                                        <a href="${fullLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                                            📄 View Full Contract
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 0; color: #9ca3af; font-size: 13px; text-align: center; line-height: 1.5;">
                                You can also download a PDF copy from the contract page.<br>
                                <a href="${fullLink}" style="color: #667eea; word-break: break-all;">${fullLink}</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fc; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 8px; color: #1a1a2e; font-size: 14px; font-weight: 600;">🍽️ Culture Gourmet</p>
                            <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px;">Thank you for trusting us with your event!</p>
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

Congratulations! Your catering agreement has been successfully signed.

Contract Summary:
- Event Date: ${contract.eventDate || 'To be confirmed'}
- Location: ${contract.eventLocation || 'To be confirmed'}
- Guest Count: ${contract.guestCount || 'To be confirmed'}
- Signed On: ${formattedDate}

View your signed contract:
${fullLink}

You can also download a PDF copy from the contract page.

Thank you for trusting us with your event!

Culture Gourmet
Elevating Your Events with Exceptional Cuisine`;

        let emailSent = false;
        let emailError = null;

        // Try Resend API first
        if (settings.resendApiKey) {
            try {
                console.log('[CG] Trying Resend API for signed copy...');
                const resend = new Resend(settings.resendApiKey);
                
                const { data, error } = await resend.emails.send({
                    from: `${fromName} <${settings.resendFromEmail || 'onboarding@resend.dev'}>`,
                    to: [contract.clientEmail],
                    subject: "✅ Your Signed Culture Gourmet Contract",
                    text: emailText,
                    html: emailHtml,
                });

                if (error) {
                    console.error('[CG] Resend API Error:', error);
                    emailError = error.message || JSON.stringify(error);
                } else {
                    emailSent = true;
                    console.log('[CG] Signed copy sent via Resend! ID:', data?.id);
                }
            } catch (err) {
                console.error('[CG] Resend Error:', err.message);
                emailError = err.message;
            }
        }

        if (!emailSent) {
            return { success: false, message: `Failed to send email: ${emailError || 'Resend API not configured'}` };
        }

        return { success: true, message: `Signed contract sent to ${contract.clientEmail}` };
    } catch (err) {
        console.error('[CG] sendSignedCopy FATAL ERROR:', err);
        return { success: false, message: 'Server error: ' + err.message };
    }
}

// ---------- Template Actions ----------

// Available variables for templates
const TEMPLATE_VARIABLES = [
    { key: '{{clientName}}', label: 'Client Name', description: 'The name of the client' },
    { key: '{{clientEmail}}', label: 'Client Email', description: 'The email of the client' },
    { key: '{{eventDate}}', label: 'Event Date', description: 'The date of the event' },
    { key: '{{eventLocation}}', label: 'Event Location', description: 'The venue/address of the event' },
    { key: '{{guestCount}}', label: 'Guest Count', description: 'Number of guests expected' },
    { key: '{{eventTime}}', label: 'Event Time', description: 'Start/End time of the event' },
    { key: '{{companyName}}', label: 'Company Name', description: 'Your company name from settings' },
    { key: '{{repName}}', label: 'Representative Name', description: 'Your representative name from settings' },
    { key: '{{todayDate}}', label: 'Today\'s Date', description: 'Current date when contract is created' },
];

async function listTemplates() {
    const collection = await getTemplatesCollection();
    const templates = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return { success: true, templates, variables: TEMPLATE_VARIABLES };
}

async function getTemplate(payload) {
    const { templateId } = payload;
    const collection = await getTemplatesCollection();
    const template = await collection.findOne({ id: templateId });

    if (!template) {
        return { success: false, message: "Template not found" };
    }

    return { success: true, template, variables: TEMPLATE_VARIABLES };
}

async function createTemplate(payload) {
    const collection = await getTemplatesCollection();
    const { name, description, body, isDefault } = payload;

    if (!name || !body) {
        return { success: false, message: "Template name and body are required" };
    }

    // If this template is set as default, unset any existing default
    if (isDefault) {
        await collection.updateMany({ isDefault: true }, { $set: { isDefault: false } });
    }

    const id = makeId();
    const template = {
        id,
        name,
        description: description || "",
        body,
        isDefault: isDefault || false,
        usageCount: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };

    await collection.insertOne(template);
    
    const templates = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return { success: true, template, templates };
}

async function updateTemplate(payload) {
    const { templateId, name, description, body, isDefault } = payload;
    const collection = await getTemplatesCollection();
    
    const template = await collection.findOne({ id: templateId });
    if (!template) {
        return { success: false, message: "Template not found" };
    }

    // If this template is set as default, unset any existing default
    if (isDefault) {
        await collection.updateMany({ isDefault: true }, { $set: { isDefault: false } });
    }

    const updates = { updatedAt: nowIso() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (body !== undefined) updates.body = body;
    if (isDefault !== undefined) updates.isDefault = isDefault;

    await collection.updateOne({ id: templateId }, { $set: updates });
    
    const templates = await collection.find({}).sort({ createdAt: -1 }).toArray();
    const updatedTemplate = await collection.findOne({ id: templateId });
    return { success: true, template: updatedTemplate, templates };
}

async function deleteTemplate(payload) {
    const { templateId } = payload;
    const collection = await getTemplatesCollection();
    
    const template = await collection.findOne({ id: templateId });
    if (!template) {
        return { success: false, message: "Template not found" };
    }

    await collection.deleteOne({ id: templateId });
    
    const templates = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return { success: true, message: "Template deleted", templates };
}

async function duplicateTemplate(payload) {
    const { templateId } = payload;
    const collection = await getTemplatesCollection();
    
    const template = await collection.findOne({ id: templateId });
    if (!template) {
        return { success: false, message: "Template not found" };
    }

    const newId = makeId();
    const newTemplate = {
        ...template,
        _id: undefined,
        id: newId,
        name: `${template.name} (Copy)`,
        isDefault: false,
        usageCount: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };
    delete newTemplate._id;

    await collection.insertOne(newTemplate);
    
    const templates = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return { success: true, template: newTemplate, templates };
}

async function setDefaultTemplate(payload) {
    const { templateId } = payload;
    const collection = await getTemplatesCollection();
    
    // Unset all defaults first
    await collection.updateMany({ isDefault: true }, { $set: { isDefault: false } });
    
    // Set the new default
    await collection.updateOne({ id: templateId }, { $set: { isDefault: true, updatedAt: nowIso() } });
    
    const templates = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return { success: true, templates };
}

async function incrementTemplateUsage(templateId) {
    const collection = await getTemplatesCollection();
    await collection.updateOne(
        { id: templateId },
        { $inc: { usageCount: 1 } }
    );
}

// Get default template or first available
async function getDefaultTemplate() {
    const collection = await getTemplatesCollection();
    let template = await collection.findOne({ isDefault: true });
    
    if (!template) {
        // Fall back to first template
        template = await collection.findOne({});
    }
    
    return { success: true, template, variables: TEMPLATE_VARIABLES };
}

// ---------- Main Handler ----------

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
            case "getCompanySettings":
                return await getCompanySettings();
            case "saveCompanySettings":
                return await saveCompanySettings(payload);
            case "getContract":
                return await getContract(payload);
            case "markAsViewed":
                return await markAsViewed(payload);
            case "signContract":
                return await signContract(payload);
            case "sendSignedCopy":
                return await sendSignedCopy(payload);
            case "updateContractStatus":
                return await updateContractStatus(payload);
            case "updateContractFields":
                return await updateContractFields(payload);
            case "deleteContract":
                return await deleteContract(payload);
            // Template actions
            case "listTemplates":
                return await listTemplates();
            case "getTemplate":
                return await getTemplate(payload);
            case "createTemplate":
                return await createTemplate(payload);
            case "updateTemplate":
                return await updateTemplate(payload);
            case "deleteTemplate":
                return await deleteTemplate(payload);
            case "duplicateTemplate":
                return await duplicateTemplate(payload);
            case "setDefaultTemplate":
                return await setDefaultTemplate(payload);
            case "getDefaultTemplate":
                return await getDefaultTemplate();
            default:
                console.warn("[CG] Unknown action:", action);
                return { success: false, message: `Unknown action: ${action}` };
        }
    } catch (err) {
        console.error("[CG] Fatal error in handler:", err);
        return { success: false, message: "Internal error in webhook script." };
    }
}
