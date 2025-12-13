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

// AppSheet Configuration
const APPSHEET_APP_ID = process.env.DEVCOAPPSHEET_APP_ID;
const APPSHEET_API_KEY = process.env.DEVCOAPPSHEET_ACCESS;
const APPSHEET_TABLE_NAME = "Estimates";

// Helper function to convert boolean to Y/N for AppSheet
function toYN(value) {
    return value === true ? 'Y' : 'N';
}

// Helper function to update AppSheet
async function updateAppSheet(data) {
    if (!APPSHEET_APP_ID || !APPSHEET_API_KEY) {
        console.log("AppSheet credentials not configured, skipping sync");
        return { skipped: true, reason: "No AppSheet credentials" };
    }

    const APPSHEET_URL = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(APPSHEET_APP_ID)}/tables/${encodeURIComponent(APPSHEET_TABLE_NAME)}/Action`;

    // Map MongoDB fields to AppSheet column names
    // Ensure all values are strings to prevent AppSheet type validation errors
    const appSheetRow = {
        "Record_Id": String(data._id || ""),
        "Estimate #": String(data.estimate || ""),
        "Date": String(data.date || ""),
        "Customer": String(data.customerId || ""),
        "Proposal No": String(data.proposalNo || ""),
        "Bid Mark UP Percentage": String(data.bidMarkUp || ""),
        "Directional Drilling": toYN(data.directionalDrilling),
        "Excavation & Backfill": toYN(data.excavationBackfill),
        "Hydro-excavation": toYN(data.hydroExcavation),
        "Potholing & Coring": toYN(data.potholingCoring),
        "Asphalt & Concrete": toYN(data.asphaltConcrete),
        "Fringe": String(data.fringe || "")
    };

    const requestBody = {
        Action: "Edit",
        Properties: {
            Locale: "en-US",
            Timezone: "Pacific Standard Time"
        },
        Rows: [appSheetRow]
    };

    console.log("Devco Backend - Sending to AppSheet:", JSON.stringify(requestBody, null, 2));

    try {
        const response = await fetch(APPSHEET_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ApplicationAccessKey": APPSHEET_API_KEY
            },
            body: JSON.stringify(requestBody)
        });

        const text = await response.text();
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            parsed = text;
        }

        if (!response.ok) {
            console.error("AppSheet Error:", response.status, parsed);
            return { success: false, error: parsed, status: response.status };
        }

        console.log("Devco Backend - AppSheet response:", parsed);
        return { success: true, response: parsed };
    } catch (error) {
        console.error("AppSheet Error:", error.message);
        return { success: false, error: error.message };
    }
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

    if (action === 'updateEstimate') {
        const payload = body.payload || {};
        const { id } = payload;
        if (!id) throw new Error("Missing id in payload");

        const connection = await getConnection();
        const Estimate = connection.model('Estimate');

        // Get existing record first
        const existing = await Estimate.findById(id);
        if (!existing) throw new Error("Estimate not found");

        // Prepare update data - only update provided fields
        const updateData = {
            updatedAt: new Date()
        };

        // Map of field names to update
        const fields = ['estimate', 'date', 'customerId', 'customerName', 'proposalNo', 'bidMarkUp', 'fringe'];
        const booleanFields = ['directionalDrilling', 'excavationBackfill', 'hydroExcavation', 'potholingCoring', 'asphaltConcrete'];

        fields.forEach(field => {
            if (payload[field] !== undefined) {
                updateData[field] = payload[field];
            }
        });

        booleanFields.forEach(field => {
            if (payload[field] !== undefined) {
                updateData[field] = payload[field] === true || payload[field] === 'true';
            }
        });

        // Update MongoDB
        const result = await Estimate.findByIdAndUpdate(id, updateData, { new: true });

        // Sync to AppSheet
        const appSheetResult = await updateAppSheet(result);

        console.log("Devco Backend - Updated estimate:", result._id);
        return {
            message: 'Estimate updated successfully',
            id: result._id,
            data: result,
            appSheet: appSheetResult
        };
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
