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
    status: { type: String, enum: ['draft', 'confirmed'], default: 'draft' },
    status: { type: String, enum: ['draft', 'confirmed'], default: 'draft' },
    fringe: { type: String },

    // Financials
    subTotal: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    _id: false // Disable auto _id generation since we're using recordId
});

// ==================== CATALOGUE SCHEMAS ====================

// 1. Equipment Items Schema
const EquipmentItemSchema = new mongoose.Schema({
    classification: { type: String },
    subClassification: { type: String },
    equipmentMachine: { type: String },
    uom: { type: String },
    supplier: { type: String },
    timePeriod: { type: String },
    cost: { type: Number, default: 0 },
    dailyCost: { type: Number, default: 0 },
    weeklyCost: { type: Number, default: 0 },
    monthlyCost: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    times: { type: Number, default: 1 },
    quantityOfTime: { type: Number, default: 0 },
    fuelAdditiveCost: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// 2. Labor Items Schema
// 2. Labor Items Schema
const LaborItemSchema = new mongoose.Schema({
    classification: { type: String },
    subClassification: { type: String },
    fringe: { type: String },
    uom: { type: String },
    cost: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    days: { type: Number, default: 0 },
    otPd: { type: Number, default: 0 },
    wCompPercent: { type: Number, default: 0 },
    payrollTaxesPercent: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// 2a. Estimate Line Items Labor Schema (New)
const EstimateLineItemsLaborSchema = new mongoose.Schema({
    estimateId: { type: String, required: true, index: true },
    labor: { type: String },
    classification: { type: String },
    subClassification: { type: String },
    fringe: { type: String },
    basePay: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    days: { type: Number, default: 0 },
    otPd: { type: Number, default: 0 },
    wCompPercent: { type: Number, default: 0 },
    payrollTaxesPercent: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// 3. Overhead Items Schema
const OverheadItemSchema = new mongoose.Schema({
    classification: { type: String },
    subClassification: { type: String },
    overhead: { type: String },
    uom: { type: String },
    days: { type: Number, default: 0 },
    hours: { type: Number, default: 0 },
    hourlyRate: { type: Number, default: 0 },
    dailyRate: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// 4. Subcontractor Items Schema
const SubcontractorItemSchema = new mongoose.Schema({
    classification: { type: String },
    subClassification: { type: String },
    subcontractor: { type: String },
    cost: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    uom: { type: String },
    total: { type: Number, default: 0 },
    notes: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// 5. Disposal Items Schema
const DisposalItemSchema = new mongoose.Schema({
    classification: { type: String },
    subClassification: { type: String },
    disposalAndHaulOff: { type: String },
    uom: { type: String },
    quantity: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// 6. Material Items Schema
const MaterialItemSchema = new mongoose.Schema({
    classification: { type: String },
    subClassification: { type: String },
    material: { type: String },
    uom: { type: String },
    supplier: { type: String },
    cost: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    taxes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// 7. Miscellaneous Items Schema
const MiscellaneousItemSchema = new mongoose.Schema({
    item: { type: String },
    classification: { type: String },
    quantity: { type: Number, default: 1 },
    uom: { type: String },
    cost: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// 8. Tool Items Schema
const ToolItemSchema = new mongoose.Schema({
    classification: { type: String },
    subClassification: { type: String },
    tool: { type: String },
    uom: { type: String },
    supplier: { type: String },
    cost: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    taxes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});


// 8a. Estimate Line Items Schemas (derived from Catalogue Schemas)
// We use .obj to clone the fields and add estimateId
const EstimateLineItemsEquipmentSchema = new mongoose.Schema({ ...EquipmentItemSchema.obj, estimateId: { type: String, required: true, index: true } });
const EstimateLineItemsOverheadSchema = new mongoose.Schema({ ...OverheadItemSchema.obj, estimateId: { type: String, required: true, index: true } });
const EstimateLineItemsSubcontractorSchema = new mongoose.Schema({ ...SubcontractorItemSchema.obj, estimateId: { type: String, required: true, index: true } });
const EstimateLineItemsDisposalSchema = new mongoose.Schema({ ...DisposalItemSchema.obj, estimateId: { type: String, required: true, index: true } });
const EstimateLineItemsMaterialSchema = new mongoose.Schema({ ...MaterialItemSchema.obj, estimateId: { type: String, required: true, index: true } });
const EstimateLineItemsMiscellaneousSchema = new mongoose.Schema({ ...MiscellaneousItemSchema.obj, estimateId: { type: String, required: true, index: true } });
const EstimateLineItemsToolSchema = new mongoose.Schema({ ...ToolItemSchema.obj, estimateId: { type: String, required: true, index: true } });

// 9. Template Schema
const TemplateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    status: { type: String, enum: ['draft', 'active'], default: 'draft' },
    content: { type: mongoose.Schema.Types.Mixed }, // Template content/configuration
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// 10. Constants Items Schema
const ConstantItemSchema = new mongoose.Schema({
    description: { type: String },
    type: { type: String },
    value: { type: String }, // Storing as String to accommodate various types, can cast later if needed
    color: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Helper to delete from AppSheet
async function deleteFromAppSheet(id) {
    if (!APPSHEET_APP_ID || !APPSHEET_API_KEY) return;

    const APPSHEET_URL = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(APPSHEET_APP_ID)}/tables/${encodeURIComponent(APPSHEET_TABLE_NAME)}/Action`;

    const requestBody = {
        Action: "Delete",
        Properties: {
            Locale: "en-US",
            Timezone: "Pacific Standard Time"
        },
        Rows: [{ "Record_Id": String(id) }]
    };

    try {
        const response = await fetch(APPSHEET_URL, {
            method: 'POST',
            headers: {
                'ApplicationAccessKey': APPSHEET_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            console.error(`AppSheet Delete Error: ${response.status} ${response.statusText}`);
        } else {
            console.log(`AppSheet record deleted: ${id}`);
        }
    } catch (error) {
        console.error("AppSheet Delete Exception:", error);
    }
}

// Main Request Handler if needed

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

    // Force re-register Estimate with updated schema
    if (conn.models.Estimate) delete conn.models.Estimate;
    conn.model('Estimate', EstimateSchema, 'estimatesdb');

    // Catalogue models
    if (!conn.models.EquipmentItem) conn.model('EquipmentItem', EquipmentItemSchema, 'equipmentItems');

    // Force re-register LaborItem with updated schema
    if (conn.models.LaborItem) delete conn.models.LaborItem;
    conn.model('LaborItem', LaborItemSchema, 'laborItems');

    if (!conn.models.EstimateLineItemsLabor) conn.model('EstimateLineItemsLabor', EstimateLineItemsLaborSchema, 'estimateLineItemsLabor');
    if (!conn.models.EstimateLineItemsEquipment) conn.model('EstimateLineItemsEquipment', EstimateLineItemsEquipmentSchema, 'estimateLineItemsEquipment');
    if (!conn.models.EstimateLineItemsOverhead) conn.model('EstimateLineItemsOverhead', EstimateLineItemsOverheadSchema, 'estimateLineItemsOverhead');
    if (!conn.models.EstimateLineItemsSubcontractor) conn.model('EstimateLineItemsSubcontractor', EstimateLineItemsSubcontractorSchema, 'estimateLineItemsSubcontractor');
    if (!conn.models.EstimateLineItemsDisposal) conn.model('EstimateLineItemsDisposal', EstimateLineItemsDisposalSchema, 'estimateLineItemsDisposal');
    if (!conn.models.EstimateLineItemsMaterial) conn.model('EstimateLineItemsMaterial', EstimateLineItemsMaterialSchema, 'estimateLineItemsMaterial');
    if (!conn.models.EstimateLineItemsMiscellaneous) conn.model('EstimateLineItemsMiscellaneous', EstimateLineItemsMiscellaneousSchema, 'estimateLineItemsMiscellaneous');
    if (!conn.models.EstimateLineItemsTool) conn.model('EstimateLineItemsTool', EstimateLineItemsToolSchema, 'estimateLineItemsTool');

    if (!conn.models.OverheadItem) conn.model('OverheadItem', OverheadItemSchema, 'overheadItems');
    if (!conn.models.SubcontractorItem) conn.model('SubcontractorItem', SubcontractorItemSchema, 'subcontractorItems');
    if (!conn.models.DisposalItem) conn.model('DisposalItem', DisposalItemSchema, 'disposalItems');
    if (!conn.models.MaterialItem) conn.model('MaterialItem', MaterialItemSchema, 'materialItems');
    if (!conn.models.MiscellaneousItem) conn.model('MiscellaneousItem', MiscellaneousItemSchema, 'miscellaneousItems');
    if (!conn.models.ToolItem) conn.model('ToolItem', ToolItemSchema, 'toolItems');
    if (!conn.models.Template) conn.model('Template', TemplateSchema, 'templates');
    if (!conn.models.ConstantItem) conn.model('ConstantItem', ConstantItemSchema, 'constantItems');

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
async function updateAppSheet(data, providedLineItems = null) {
    if (!APPSHEET_APP_ID || !APPSHEET_API_KEY) {
        console.log("AppSheet credentials not configured, skipping sync");
        return { skipped: true, reason: "No AppSheet credentials" };
    }

    // Use provided line items (from payload) OR fetch from DB as fallback
    let lineItems = {};
    const connection = await getConnection();
    const constants = await connection.model('ConstantItem').find({}).lean();

    if (providedLineItems) {
        // Use direct data to avoid race conditions
        console.log("updateAppSheet: Using provided line items for calculation");
        lineItems = {
            labor: providedLineItems.labor || [],
            equipment: providedLineItems.equipment || [],
            material: providedLineItems.material || [],
            tools: providedLineItems.tools || [],
            overhead: providedLineItems.overhead || [],
            subcontractor: providedLineItems.subcontractor || [],
            disposal: providedLineItems.disposal || [],
            miscellaneous: providedLineItems.miscellaneous || []
        };
    } else {
        // Fallback to DB fetch
        console.log("updateAppSheet: Fetching line items from DB");
        const fetchItems = (modelName) => connection.model(modelName).find({ estimateId: data._id }).lean();
        const [labor, equipment, material, tools, overhead, subcontractor, disposal, miscellaneous] = await Promise.all([
            fetchItems('EstimateLineItemsLabor'),
            fetchItems('EstimateLineItemsEquipment'),
            fetchItems('EstimateLineItemsMaterial'),
            fetchItems('EstimateLineItemsTool'),
            fetchItems('EstimateLineItemsOverhead'),
            fetchItems('EstimateLineItemsSubcontractor'),
            fetchItems('EstimateLineItemsDisposal'),
            fetchItems('EstimateLineItemsMiscellaneous')
        ]);

        lineItems = { labor, equipment, material, tools, overhead, subcontractor, disposal, miscellaneous };
    }

    const { labor, equipment, material, tools, overhead, subcontractor, disposal, miscellaneous } = lineItems;

    // Helpers
    const parseNum = (val) => parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;

    const getFringeRate = (desc) => {
        if (!desc) return 0;
        const c = constants.find(conn => conn.description === desc);
        return c ? (parseFloat(String(c.value).replace(/[^0-9.-]+/g, "")) || 0) : 0;
    };

    const calculateLaborTotal = (item) => {
        const subClass = (item.subClassification || '').toLowerCase();
        if (subClass === 'per diem' || subClass === 'hotel') {
            return parseNum(item.basePay) * parseNum(item.quantity) * parseNum(item.days);
        }
        const basePay = parseNum(item.basePay);
        const qty = parseNum(item.quantity);
        const days = parseNum(item.days);
        const otPd = parseNum(item.otPd);
        const wCompPct = parseNum(item.wCompPercent);
        const taxesPct = parseNum(item.payrollTaxesPercent);
        const fringeRate = getFringeRate(item.fringe);
        const totalHours = qty * days * 8;
        const totalOtHours = qty * days * otPd;
        const wCompTaxAmount = basePay * (wCompPct / 100);
        const payrollTaxAmount = basePay * (taxesPct / 100);
        const otPayrollTaxAmount = basePay * 1.5 * (taxesPct / 100);
        const fringeAmount = fringeRate;
        const baseRate = basePay + wCompTaxAmount + payrollTaxAmount + fringeAmount;
        const otBasePay = basePay * 1.5;
        const otRate = otBasePay + wCompTaxAmount + otPayrollTaxAmount + fringeAmount;
        return (totalHours * baseRate) + (totalOtHours * otRate);
    };

    const calculateEquipmentTotal = (item) => {
        const qty = item.quantity || 0;
        const times = item.times !== undefined ? item.times : 1;
        const uom = item.uom || 'Daily';
        let val = 0;
        if (uom === 'Daily') val = (item.dailyCost || 0);
        else if (uom === 'Weekly') val = (item.weeklyCost || 0);
        else if (uom === 'Monthly') val = (item.monthlyCost || 0);
        else val = (item.dailyCost || 0);

        return val * qty * times;
    };

    const simpleSum = (items) => items.reduce((sum, i) => sum + ((i.cost || 0) * (i.quantity || 1)), 0);
    const costOnlySum = (items) => items.reduce((sum, i) => sum + (i.cost || 0), 0);

    // Calculate Category Totals
    const laborTotal = labor.reduce((sum, item) => sum + calculateLaborTotal(item), 0);
    const equipmentTotal = equipment.reduce((sum, item) => sum + calculateEquipmentTotal(item), 0);
    const materialTotal = simpleSum(material);
    const toolsTotal = simpleSum(tools);
    const overheadTotal = simpleSum(overhead);
    const subcontractorTotal = costOnlySum(subcontractor);
    const disposalTotal = simpleSum(disposal);
    const miscellaneousTotal = simpleSum(miscellaneous);

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
        "Fringe": String(data.fringe || ""),

        // Calculated Totals
        "Labor": String(laborTotal.toFixed(2)),
        "Equipment": String(equipmentTotal.toFixed(2)),
        "Material": String(materialTotal.toFixed(2)),
        "Tools": String(toolsTotal.toFixed(2)),
        "Overhead": String(overheadTotal.toFixed(2)),
        "Subcontractor": String(subcontractorTotal.toFixed(2)),
        "Disposal": String(disposalTotal.toFixed(2)),
        "Miscellaneous": String(miscellaneousTotal.toFixed(2)),

        // Financials (from saved data)
        "subTotal": String((data.subTotal || 0).toFixed(2)),
        "margin": String((data.margin || 0).toFixed(2)),
        "grandTotal": String((data.grandTotal || 0).toFixed(2))
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
            ...(estimateData.fringe !== undefined && { fringe: estimateData.fringe }),
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
        const est = await Estimate.findById(id).lean();

        if (est) {
            // Debug: Log service fields
            console.log('getEstimateById - Service fields:', {
                id: est._id,
                directionalDrilling: est.directionalDrilling,
                excavationBackfill: est.excavationBackfill,
                hydroExcavation: est.hydroExcavation,
                potholingCoring: est.potholingCoring,
                asphaltConcrete: est.asphaltConcrete
            });

            // Fetch and attach line items
            // Fetch and attach line items in parallel
            const fetchItems = async (model) => {
                const items = await connection.model(model).find({ estimateId: id }).lean();
                if (model === 'EstimateLineItemsMiscellaneous') {
                    console.log('getEstimateById - Fetched Miscellaneous:', {
                        count: items.length,
                        ids: items.map(i => i._id),
                        sample: items[0]
                    });
                }
                return items;
            };

            const [
                labor,
                equipment,
                material,
                tools,
                overhead,
                subcontractor,
                disposal,
                miscellaneous
            ] = await Promise.all([
                fetchItems('EstimateLineItemsLabor'),
                fetchItems('EstimateLineItemsEquipment'),
                fetchItems('EstimateLineItemsMaterial'),
                fetchItems('EstimateLineItemsTool'),
                fetchItems('EstimateLineItemsOverhead'),
                fetchItems('EstimateLineItemsSubcontractor'),
                fetchItems('EstimateLineItemsDisposal'),
                fetchItems('EstimateLineItemsMiscellaneous')
            ]);

            // Debug: Check if miscellaneous matches what we expect
            console.log('getEstimateById - Miscellaneous being attached:', {
                fromDB: miscellaneous?.length,
                firstId: miscellaneous?.[0]?._id,
                estimateEmbedded: est.miscellaneous?.length,
                estimateEmbeddedId: est.miscellaneous?.[0]?._id
            });

            est.labor = labor;
            est.equipment = equipment;
            est.material = material;
            est.tools = tools;
            est.overhead = overhead;
            est.subcontractor = subcontractor;
            est.disposal = disposal;
            est.miscellaneous = miscellaneous;
        }

        return est;
    }

    // Get all estimates with the same Proposal Number (for version timeline)
    if (action === 'getEstimatesByProposal') {
        const { proposalNo, excludeId } = body.payload || {};
        if (!proposalNo) throw new Error("Missing proposalNo in payload");

        const connection = await getConnection();
        const Estimate = connection.model('Estimate');

        // Find all estimates with the same proposal number
        const query = { proposalNo: proposalNo };

        let estimates = await Estimate.find(query)
            .lean();

        // Parse date string (M/D/YYYY or MM/DD/YYYY format) to Date object for sorting
        const parseEstimateDate = (dateStr) => {
            if (!dateStr) return new Date(0); // Put items without dates first
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const month = parseInt(parts[0], 10) - 1; // Months are 0-indexed
                const day = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                return new Date(year, month, day);
            }
            return new Date(0);
        };

        // Sort by the estimate date field (oldest first = V1)
        estimates.sort((a, b) => {
            const dateA = parseEstimateDate(a.date);
            const dateB = parseEstimateDate(b.date);
            return dateA - dateB;
        });

        // Assign version numbers (oldest date = V1, newest date = highest version)
        estimates.forEach((est, idx) => {
            est.versionNumber = idx + 1;
        });

        // Fetch Fringe Constants once for labor calculations
        const ConstantItem = connection.model('ConstantItem');
        const fringeConstants = await ConstantItem.find({ $or: [{ type: 'constant' }, { type: 'Fringe' }] }).lean();

        const getFringeRate = (fringeDescription) => {
            if (!fringeDescription) return 0;
            const constant = fringeConstants.find(c => c.description === fringeDescription);
            if (!constant || !constant.value) return 0;
            return parseFloat(String(constant.value).replace(/[^0-9.-]+/g, "")) || 0;
        };

        const calculateLaborTotal = (item) => {
            const parseNum = (val) => parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;
            const subClass = (item.subClassification || '').toLowerCase();

            // Special cases
            if (subClass === 'per diem' || subClass === 'hotel') {
                return parseNum(item.basePay) * parseNum(item.quantity) * parseNum(item.days);
            }

            const basePay = parseNum(item.basePay);
            const qty = parseNum(item.quantity);
            const days = parseNum(item.days);
            const otPd = parseNum(item.otPd);
            const wCompPct = parseNum(item.wCompPercent);
            const taxesPct = parseNum(item.payrollTaxesPercent);
            const fringeRate = getFringeRate(item.fringe);

            const totalHours = qty * days * 8;
            const totalOtHours = qty * days * otPd;

            const wCompTaxAmount = basePay * (wCompPct / 100);
            const payrollTaxAmount = basePay * (taxesPct / 100);
            const otPayrollTaxAmount = basePay * 1.5 * (taxesPct / 100);
            const fringeAmount = fringeRate;

            const baseRate = basePay + wCompTaxAmount + payrollTaxAmount + fringeAmount;

            // Spreadsheet Formula for OT Rate
            const otBasePay = basePay * 1.5;
            const otRate = otBasePay + wCompTaxAmount + otPayrollTaxAmount + fringeAmount;

            return (totalHours * baseRate) + (totalOtHours * otRate);
        };

        const calculateEquipmentTotal = (item) => {
            const qty = item.quantity || 0;
            const uom = item.uom || 'Daily';
            let calculatedTotal = 0;

            if (uom === 'Daily') calculatedTotal = (item.dailyCost || 0) * qty;
            else if (uom === 'Weekly') calculatedTotal = (item.weeklyCost || 0) * qty;
            else if (uom === 'Monthly') calculatedTotal = (item.monthlyCost || 0) * qty;
            else calculatedTotal = (item.dailyCost || 0) * qty; // Default

            return calculatedTotal;
        };

        // For each estimate, calculate quick total from line items in parallel
        await Promise.all(estimates.map(async (est) => {
            const fetchItems = (model) => connection.model(model).find({ estimateId: est._id }).lean();

            const [
                labor,
                equipment,
                material,
                tools,
                overhead,
                subcontractor,
                disposal,
                miscellaneous
            ] = await Promise.all([
                fetchItems('EstimateLineItemsLabor'),
                fetchItems('EstimateLineItemsEquipment'),
                fetchItems('EstimateLineItemsMaterial'),
                fetchItems('EstimateLineItemsTool'),
                fetchItems('EstimateLineItemsOverhead'),
                fetchItems('EstimateLineItemsSubcontractor'),
                fetchItems('EstimateLineItemsDisposal'),
                fetchItems('EstimateLineItemsMiscellaneous')
            ]);

            // Calculate section totals using detailed logic
            const laborTotal = labor.reduce((sum, item) => sum + (item.total || calculateLaborTotal(item)), 0);
            const equipmentTotal = equipment.reduce((sum, item) => sum + (item.total || calculateEquipmentTotal(item)), 0);

            // For other sections, fallback to simple cost * quantity if total is missing
            const simpleCalc = (items) => items.reduce((sum, i) => sum + (i.total || ((i.cost || 0) * (i.quantity || 1))), 0);
            const costOnlyCalc = (items) => items.reduce((sum, i) => sum + (i.total || (i.cost || 0)), 0);

            const materialTotal = simpleCalc(material);
            const toolsTotal = simpleCalc(tools);
            const overheadTotal = simpleCalc(overhead);
            const subcontractorTotal = costOnlyCalc(subcontractor);
            const disposalTotal = simpleCalc(disposal);
            const miscellaneousTotal = simpleCalc(miscellaneous);

            const subtotal =
                laborTotal +
                equipmentTotal +
                materialTotal +
                toolsTotal +
                overheadTotal +
                subcontractorTotal +
                disposalTotal +
                miscellaneousTotal;

            // Calculate Markup
            const markupStr = est.bidMarkUp || '0%';
            const markupPct = parseFloat(String(markupStr).replace(/[^0-9.-]+/g, "")) || 0;
            const markupAmount = subtotal * (markupPct / 100);

            // Use stored Grand Total if available, otherwise calculate it
            // This ensures backward compatibility with older estimates while favoring new stored values
            if (est.grandTotal !== undefined && est.grandTotal > 0) {
                est.totalAmount = est.grandTotal;
            } else {
                est.totalAmount = subtotal + markupAmount;
            }
        }));

        return estimates;
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

        // Whitelist allowed fields to prevent overwriting critical metadata accidentally
        const allowedFields = [
            'estimate', 'date', 'customerId', 'customerName', 'proposalNo', 'bidMarkUp',
            'directionalDrilling', 'excavationBackfill', 'hydroExcavation', 'potholingCoring', 'asphaltConcrete',
            'status', 'fringe', 'subTotal', 'margin', 'grandTotal'
        ];

        allowedFields.forEach(field => {
            if (payload[field] !== undefined) {
                updateData[field] = payload[field];
            }
        });

        // Update Line Items if provided in payload
        const lineItemModels = {
            labor: 'EstimateLineItemsLabor',
            equipment: 'EstimateLineItemsEquipment',
            material: 'EstimateLineItemsMaterial',
            tools: 'EstimateLineItemsTool', // Note: key is 'tools' in payload, model alias is 'Tool' but collection is correct
            overhead: 'EstimateLineItemsOverhead',
            subcontractor: 'EstimateLineItemsSubcontractor',
            disposal: 'EstimateLineItemsDisposal',
            miscellaneous: 'EstimateLineItemsMiscellaneous'
        };

        await Promise.all(Object.keys(lineItemModels).map(async (key) => {
            if (payload[key] && Array.isArray(payload[key])) {
                const Model = connection.model(lineItemModels[key]);
                // Delete existing items for this estimate
                await Model.deleteMany({ estimateId: id });

                // Prepare new items (ensure estimateId is attached)
                const items = payload[key].map(item => ({
                    ...item,
                    estimateId: id,
                    _id: undefined // Let Mongo generate new IDs for lines or keep if you strictly want to preserve
                }));

                if (items.length > 0) {
                    await Model.insertMany(items);
                }
            }
        }));


        console.log('updateEstimate - Update data being saved:', updateData);

        // Update MongoDB
        const result = await Estimate.findByIdAndUpdate(id, updateData, { new: true });

        // Debug: Log the result's boolean fields
        console.log('updateEstimate - Result from MongoDB:', {
            directionalDrilling: result.directionalDrilling,
            excavationBackfill: result.excavationBackfill,
            hydroExcavation: result.hydroExcavation,
            potholingCoring: result.potholingCoring,
            asphaltConcrete: result.asphaltConcrete
        });

        // Sync to AppSheet - Pass payload directly to ensure we use the FRESH line items
        // This avoids race conditions where DB read might still see old deleted items
        const appSheetResult = await updateAppSheet(result, payload);

        console.log("Devco Backend - Updated estimate:", result._id);
        return {
            success: true,
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

    // Delete estimate from AppSheet webhook (supports estimateId or _id)
    if (action === 'deleteEstimateFromAppSheet') {
        const { estimateId, _id, Row_ID } = body.payload || body;
        const idToUse = estimateId || _id || Row_ID;

        if (!idToUse) {
            throw new Error("Missing estimateId, _id, or Row_ID in payload");
        }

        const connection = await getConnection();
        const Estimate = connection.model('Estimate');

        // Try to find by estimateId first, then by _id
        let result = await Estimate.findOneAndDelete({ estimateId: idToUse });

        if (!result) {
            // Try deleting by MongoDB _id if it's a valid ObjectId
            try {
                result = await Estimate.findByIdAndDelete(idToUse);
            } catch (e) {
                // Invalid ObjectId format, ignore
            }
        }

        if (!result) {
            return { message: `No estimate found with id: ${idToUse}`, deleted: false };
        }

        // NOTE: Intentionally NOT deleting from AppSheet - only removing from MongoDB
        // The AppSheet record will be preserved for historical/reporting purposes
        console.log(`Deleted estimate from MongoDB (AppSheet record preserved): ${idToUse}`);
        return {
            message: 'Estimate deleted from MongoDB (AppSheet record preserved)',
            deleted: true,
            estimateId: idToUse
        };
    }

    // ==================== CATALOGUE OPERATIONS ====================

    // Model mapping for catalogue types
    const catalogueModels = {
        equipment: 'EquipmentItem',
        labor: 'LaborItem',
        overhead: 'OverheadItem',
        subcontractor: 'SubcontractorItem',
        disposal: 'DisposalItem',
        material: 'MaterialItem',
        miscellaneous: 'MiscellaneousItem',
        tool: 'ToolItem',
        estimateLineItemsLabor: 'EstimateLineItemsLabor',
        estimateLineItemsEquipment: 'EstimateLineItemsEquipment',
        estimateLineItemsOverhead: 'EstimateLineItemsOverhead',
        estimateLineItemsSubcontractor: 'EstimateLineItemsSubcontractor',
        estimateLineItemsDisposal: 'EstimateLineItemsDisposal',
        estimateLineItemsMaterial: 'EstimateLineItemsMaterial',
        estimateLineItemsMiscellaneous: 'EstimateLineItemsMiscellaneous',
        estimateLineItemsTool: 'EstimateLineItemsTool',
        constant: 'ConstantItem'
    };

    // Get all items for a catalogue type
    if (action === 'getCatalogueItems') {
        const { type } = body.payload || {};
        if (!type || !catalogueModels[type]) {
            throw new Error("Invalid or missing catalogue type. Valid types: " + Object.keys(catalogueModels).join(', '));
        }

        const connection = await getConnection();
        const Model = connection.model(catalogueModels[type]);
        // Special sorting for constants if needed, otherwise default
        return await Model.find().sort({ description: 1 });
    }

    // Get summary/counts for all catalogue types (for dashboard)
    if (action === 'getCatalogueSummary') {
        const connection = await getConnection();
        const summary = {};

        for (const [key, modelName] of Object.entries(catalogueModels)) {
            const Model = connection.model(modelName);
            summary[key] = await Model.countDocuments();
        }

        return summary;
    }

    // Add a new catalogue item
    if (action === 'addCatalogueItem') {
        const { type, data } = body.payload || {};
        if (!type || !catalogueModels[type]) {
            throw new Error("Invalid or missing catalogue type");
        }
        if (!data) throw new Error("Missing item data");

        const connection = await getConnection();
        const Model = connection.model(catalogueModels[type]);

        // Duplicate Check for Labor
        if (type === 'labor') {
            const normalize = (val) => String(val || '').trim().toLowerCase();
            const composite = (d) => `${normalize(d.classification)}|${normalize(d.subClassification)}|${normalize(d.fringe)}`;

            const targetKey = composite(data);

            // Use lean() for better performance and simple objects
            const allItems = await Model.find({}).lean();

            const duplicate = allItems.find(item => {
                // Determine if this is a different item
                // For 'add', data._id is usually undefined, so it won't match item._id
                // For 'update' (handled below, but reusing logic pattern), we check IDs
                const isSelf = data._id && String(item._id) === String(data._id);
                if (isSelf) return false;

                return composite(item) === targetKey;
            });

            if (duplicate) {
                return {
                    success: false,
                    error: `Duplicate Item: This combination already exists (matches item with ID: ${duplicate._id}).`
                };
            }
        }

        const result = await Model.create(data);

        return {
            success: true,
            message: 'Item added successfully',
            id: result._id,
            data: result
        };
    }

    // Update a catalogue item
    if (action === 'updateCatalogueItem') {
        const { type, id, data } = body.payload || {};
        if (!type || !catalogueModels[type]) {
            throw new Error("Invalid or missing catalogue type");
        }
        if (!id) throw new Error("Missing item id");
        if (!data) throw new Error("Missing item data");

        const connection = await getConnection();
        const Model = connection.model(catalogueModels[type]);

        // Duplicate Check for Labor
        if (type === 'labor') {
            const normalize = (val) => String(val || '').trim().toLowerCase();
            const composite = (d) => `${normalize(d.classification)}|${normalize(d.subClassification)}|${normalize(d.fringe)}`;

            const targetKey = composite(data);

            const allItems = await Model.find({}).lean();

            const duplicate = allItems.find(item => {
                // Exclude self from check
                if (String(item._id) === String(id)) return false;

                return composite(item) === targetKey;
            });

            if (duplicate) {
                return {
                    success: false,
                    error: `Duplicate Item: This combination already exists (matches item with ID: ${duplicate._id}).`
                };
            }
        }

        data.updatedAt = new Date();

        // Debug logging
        console.log('updateCatalogueItem - Attempting update:', {
            type: type,
            modelName: catalogueModels[type],
            id: id,
            data: data
        });

        const result = await Model.findByIdAndUpdate(id, data, { new: true });

        // Debug: If not found, check what exists
        if (!result) {
            const count = await Model.countDocuments();
            const sample = await Model.findOne().lean();
            console.log('updateCatalogueItem - Item not found. Debug info:', {
                totalDocuments: count,
                sampleDoc: sample ? { _id: sample._id, estimateId: sample.estimateId } : null
            });
            throw new Error("Item not found");
        }

        return {
            message: 'Item updated successfully',
            id: result._id,
            data: result
        };
    }

    // Delete a catalogue item
    if (action === 'deleteCatalogueItem') {
        const { type, id } = body.payload || {};
        if (!type || !catalogueModels[type]) {
            throw new Error("Invalid or missing catalogue type");
        }
        if (!id) throw new Error("Missing item id");

        const connection = await getConnection();
        const Model = connection.model(catalogueModels[type]);
        const result = await Model.findByIdAndDelete(id);

        if (!result) throw new Error("Item not found");

        return {
            message: 'Item deleted successfully',
            id: id
        };
    }

    // ==================== TEMPLATE ACTIONS ====================

    // Get all templates
    if (action === 'getTemplates') {
        const connection = await getConnection();
        const Template = connection.model('Template');
        const templates = await Template.find({}).sort({ createdAt: -1 }).lean();
        return templates;
    }

    // Add a new template
    if (action === 'addTemplate') {
        const { name, description, category, status, content } = body.payload || {};
        if (!name) throw new Error("Template name is required");

        const connection = await getConnection();
        const Template = connection.model('Template');
        const newTemplate = new Template({
            name,
            description,
            category,
            status: status || 'draft',
            content
        });
        const result = await newTemplate.save();

        return {
            message: 'Template created successfully',
            id: result._id,
            data: result
        };
    }

    // Update a template
    if (action === 'updateTemplate') {
        const { id, name, description, category, status, content } = body.payload || {};
        if (!id) throw new Error("Template id is required");

        const connection = await getConnection();
        const Template = connection.model('Template');
        const updateData = { updatedAt: new Date() };
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (category !== undefined) updateData.category = category;
        if (status !== undefined) updateData.status = status;
        if (content !== undefined) updateData.content = content;

        const result = await Template.findByIdAndUpdate(id, updateData, { new: true }).lean();
        if (!result) throw new Error("Template not found");

        return {
            message: 'Template updated successfully',
            id: result._id,
            data: result
        };
    }

    // Delete a template
    if (action === 'deleteTemplate') {
        const { id } = body.payload || {};
        if (!id) throw new Error("Template id is required");

        const connection = await getConnection();
        const Template = connection.model('Template');
        const result = await Template.findByIdAndDelete(id);
        if (!result) throw new Error("Template not found");

        return {
            message: 'Template deleted successfully',
            id: id
        };
    }

    throw new Error("Unknown action or missing Data.recordId in payload");
}
