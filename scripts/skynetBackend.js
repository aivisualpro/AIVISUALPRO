
import mongoose from 'mongoose';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config(); // Reload .env to ensure new keys are picked up

// Cache connection to avoid reconnection overhead on every webhook call
let conn = null;

// Schemas
const ClientSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    company: String,
    address: String,
    createdAt: { type: Date, default: Date.now }
});

const ProposalSchema = new mongoose.Schema({
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    clientName: String,
    clientEmail: String,
    title: String,
    content: String, // HTML content of the proposal
    formData: mongoose.Schema.Types.Mixed,
    status: {
        type: String,
        enum: ['DRAFT', 'SIGNED_PARTIAL', 'READY_TO_SEND', 'SENT', 'SIGNED_CLIENT'],
        default: 'DRAFT'
    },
    signatures: {
        adeel: {
            signed: { type: Boolean, default: false },
            date: Date,
            signatureData: String
        },
        sagheer: {
            signed: { type: Boolean, default: false },
            date: Date,
            signatureData: String
        },
        client: {
            signed: { type: Boolean, default: false },
            date: Date,
            signatureData: String
        }
    },
    history: [{
        action: String,
        date: { type: Date, default: Date.now },
        details: String
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

async function getConnection() {
    if (conn && conn.readyState === 1) return conn;

    const uri = process.env.SKYNETSILICONMONGODB_URI;
    if (!uri) throw new Error("Missing SKYNETSILICONMONGODB_URI");

    conn = mongoose.createConnection(uri);

    // Wait for connection to open
    await new Promise((resolve, reject) => {
        conn.once('open', resolve);
        conn.once('error', reject);
    });

    // Register models if not already registered
    if (!conn.models.Client) conn.model('Client', ClientSchema);
    if (!conn.models.Proposal) conn.model('Proposal', ProposalSchema);

    return conn;
}

export default async function (body) {
    const { action, payload } = body;
    const connection = await getConnection();
    const Client = connection.model('Client');
    const Proposal = connection.model('Proposal');
    const resend = new Resend(process.env.SKN_RESEND_API_KEY);

    if (action === 'login') {
        const { username, password } = payload;
        // Hardcoded credentials as requested
        if (username === 'adeeljabbar' && password === 'Abc123***') {
            return { token: 'adeel-token', user: { name: 'Adeel Jabbar', role: 'admin', id: 'adeel' } };
        }
        if (username === 'sagheerhussain' && password === 'Abc123***') {
            return { token: 'sagheer-token', user: { name: 'Sagheer Hussain', role: 'admin', id: 'sagheer' } };
        }
        throw new Error("Invalid credentials");
    }

    if (action === 'getClients') {
        return await Client.find().sort({ createdAt: -1 });
    }

    if (action === 'saveClient') {
        if (payload._id) {
            return await Client.findByIdAndUpdate(payload._id, payload, { new: true });
        } else {
            return await Client.create(payload);
        }
    }

    if (action === 'deleteClient') {
        return await Client.findByIdAndDelete(payload.id);
    }

    if (action === 'getProposals') {
        return await Proposal.find().sort({ createdAt: -1 });
    }

    if (action === 'getProposalById') {
        // Publicly accessible for client view (in practice, should have a token, but req says client no password)
        return await Proposal.findById(payload.id);
    }

    if (action === 'saveProposal') {
        // Create or Update Draft
        const data = {
            ...payload,
            updatedAt: new Date()
        };

        if (payload._id) {
            return await Proposal.findByIdAndUpdate(payload._id, data, { new: true });
        } else {
            return await Proposal.create(data);
        }
    }

    if (action === 'deleteProposal') {
        return await Proposal.findByIdAndDelete(payload.id);
    }
    if (action === 'signProposalInternal') {
        const { proposalId, signerId, signatureData } = payload;
        const proposal = await Proposal.findById(proposalId);
        if (!proposal) throw new Error("Proposal not found");

        if (signerId === 'adeel') {
            proposal.signatures.adeel = { signed: true, date: new Date(), signatureData };
        } else if (signerId === 'sagheer') {
            proposal.signatures.sagheer = { signed: true, date: new Date(), signatureData };
        } else {
            throw new Error("Invalid signer");
        }

        // Check if both signed
        if (proposal.signatures.adeel.signed && proposal.signatures.sagheer.signed) {
            proposal.status = 'READY_TO_SEND';
        } else {
            proposal.status = 'SIGNED_PARTIAL';
        }

        proposal.history.push({ action: `Signed by ${signerId}`, details: 'Internal signature' });
        return await proposal.save();
    }

    if (action === 'sendProposalToClient') {
        const { proposalId, clientLink } = payload;
        const proposal = await Proposal.findById(proposalId);

        if (proposal.status !== 'READY_TO_SEND' && proposal.status !== 'SENT') {
            // Allow resending if SENT, but ideally must be READY_TO_SEND
            if (proposal.status === 'DRAFT' || proposal.status === 'SIGNED_PARTIAL') {
                throw new Error("Proposal must be signed by both admins before sending.");
            }
        }

        // Send Email
        const { data, error } = await resend.emails.send({
            from: process.env.SKN_RESEND_FROM_EMAIL || 'proposals@updates.aivisualpro.com',
            to: [proposal.clientEmail],
            subject: `Proposal: ${proposal.title} - Action Required`,
            html: `
                <p>Dear ${proposal.clientName},</p>
                <p>You have received a new proposal from Skynet Silicon.</p>
                <p>Please click the link below to review and sign the proposal:</p>
                <p><a href="${clientLink}?id=${proposal._id}">View and Sign Proposal</a></p>
                <br/>
                <p>Regards,</p>
                <p>Skynet Silicon Team</p>
            `,
        });

        if (error) {
            console.error("Resend Error:", error);
            throw new Error("Failed to send email: " + error.message);
        }

        proposal.status = 'SENT';
        proposal.history.push({ action: 'Sent to Client', details: `Emailed to ${proposal.clientEmail}` });
        return await proposal.save();
    }

    if (action === 'clientSignProposal') {
        const { proposalId, signatureData } = payload;
        const proposal = await Proposal.findById(proposalId);
        if (!proposal) throw new Error("Proposal not found");

        if (!proposal.signatures.adeel.signed || !proposal.signatures.sagheer.signed) {
            throw new Error("Proposal must be signed by both admins before you can sign.");
        }

        proposal.signatures.client = { signed: true, date: new Date(), signatureData };
        proposal.status = 'SIGNED_CLIENT';
        proposal.history.push({ action: 'Signed by Client', details: 'Client signature received' });

        const result = await proposal.save();

        // Notify Admins (Optional but good)
        // We could fire and forget, but let's just log for now or send if easy.
        // Let's send a notification email to admins
        try {
            await resend.emails.send({
                from: process.env.SKN_RESEND_FROM_EMAIL,
                to: ['admin@aivisualpro.com', 'skynetsilicon110@gmail.com'],
                subject: `Proposal Signed by Client: ${proposal.title}`,
                html: `<p>The proposal "${proposal.title}" has been signed by the client.</p>`
            });
        } catch (e) {
            console.log("Failed to send admin notification", e);
        }

        return result;
    }

    throw new Error("Unknown action");
}
