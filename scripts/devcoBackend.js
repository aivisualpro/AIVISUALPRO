import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Cache connection to avoid reconnection overhead on every webhook call
let conn = null;

// Helper function to convert Y/N strings to boolean
function toBoolean(value) {
    if (value === 'Y' || value === 'y' || value === true) return true;
    return false; // N, n, empty string, null, undefined all become false
}

// Estimate Schema - using recordId as the MongoDB _id
const EstimateSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // recordId will be used as _id
    estimate: { type: String },
    date: { type: String },
    customerId: { type: String },
    customerName: { type: String },
    proposalNo: { type: String },
    bidMarkUp: { type: String },
    directionalDrilling: { type: Boolean, default: false },
    excavationBackfill: { type: Boolean, default: false },
    hydroExcavation: { type: Boolean, default: false },
    potholingCoring: { type: Boolean, default: false },
    asphaltConcrete: { type: Boolean, default: false },
    fringe: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    _id: false // Disable auto _id generation since we're using recordId
});

async function getConnection() {
    if (conn && conn.readyState === 1) return conn;

    const uri = process.env.DEVCOAPPSHEET_MONGODB_URI;
    if (!uri) throw new Error("Missing DEVCOAPPSHEET_MONGODB_URI in environment variables");

    conn = mongoose.createConnection(uri);

    // Wait for connection to open
    await new Promise((resolve, reject) => {
        conn.once('open', resolve);
        conn.once('error', reject);
    });

    // Register models if not already registered
    // Collection name will be 'estimatesdb' as requested
    if (!conn.models.Estimate) {
        conn.model('Estimate', EstimateSchema, 'estimatesdb');
    }

    return conn;
}

export default async function (body) {
    console.log("Devco Backend - Received body:", JSON.stringify(body, null, 2));

    // Handle both direct payload and nested Data structure
    const data = body.Data || body;
    const { action } = body;

    // If it's a webhook payload with Data object, save the estimate
    if (body.Data && body.Data.recordId) {
        const estimateData = body.Data;
        const connection = await getConnection();
        const Estimate = connection.model('Estimate');

        // Prepare data with recordId as _id
        // Convert Y/N values to boolean for the relevant fields
        const docData = {
            _id: estimateData.recordId,
            estimate: estimateData.estimate,
            date: estimateData.date,
            customerId: estimateData.customerId,
            customerName: estimateData.customerName,
            proposalNo: estimateData.proposalNo,
            bidMarkUp: estimateData.bidMarkUp,
            directionalDrilling: toBoolean(estimateData.directionalDrilling),
            excavationBackfill: toBoolean(estimateData.excavationBackfill),
            hydroExcavation: toBoolean(estimateData.hydroExcavation),
            potholingCoring: toBoolean(estimateData.potholingCoring),
            asphaltConcrete: toBoolean(estimateData.asphaltConcrete),
            fringe: estimateData.fringe,
            updatedAt: new Date()
        };

        // Upsert - update if exists, create if not
        const result = await Estimate.findByIdAndUpdate(
            estimateData.recordId,
            docData,
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        console.log("Devco Backend - Saved estimate:", result._id);
        return {
            message: 'Estimate saved successfully',
            id: result._id,
            data: result
        };
    }

    // Handle action-based requests (for future API expansions)
    if (action === 'getEstimates') {
        const connection = await getConnection();
        const Estimate = connection.model('Estimate');
        return await Estimate.find().sort({ createdAt: -1 });
    }

    if (action === 'getEstimateById') {
        const { id } = body.payload || {};
        if (!id) throw new Error("Missing id in payload");

        const connection = await getConnection();
        const Estimate = connection.model('Estimate');
        return await Estimate.findById(id);
    }

    if (action === 'deleteEstimate') {
        const { id } = body.payload || {};
        if (!id) throw new Error("Missing id in payload");

        const connection = await getConnection();
        const Estimate = connection.model('Estimate');
        return await Estimate.findByIdAndDelete(id);
    }

    throw new Error("Unknown action or missing Data.recordId in payload");
}
