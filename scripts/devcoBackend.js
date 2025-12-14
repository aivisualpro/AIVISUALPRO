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
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// 4. Subcontractor Items Schema
const SubcontractorItemSchema = new mongoose.Schema({
    classification: { type: String },
    subClassification: { type: String },
    subcontractor: { type: String },
    uom: { type: String },
    notes: { type: String },
    cost: { type: Number, default: 0 },
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
    classification: { type: String },
    subClassification: { type: String },
    item: { type: String },
    uom: { type: String },
    quantity: { type: Number, default: 0 },
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
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
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
    if (!conn.models.Estimate) conn.model('Estimate', EstimateSchema, 'estimatesdb');

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
        // "Directional Drilling": toYN(data.directionalDrilling),
        // "Excavation & Backfill": toYN(data.excavationBackfill),
        // "Hydro-excavation": toYN(data.hydroExcavation),
        // "Potholing & Coring": toYN(data.potholingCoring),
        // "Asphalt & Concrete": toYN(data.asphaltConcrete),
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
            // Fetch and attach line items
            const fetchItems = async (model) => connection.model(model).find({ estimateId: id }).lean();

            est.labor = await fetchItems('EstimateLineItemsLabor');
            est.equipment = await fetchItems('EstimateLineItemsEquipment');
            est.material = await fetchItems('EstimateLineItemsMaterial');
            est.tools = await fetchItems('EstimateLineItemsTool');
            est.overhead = await fetchItems('EstimateLineItemsOverhead');
            est.subcontractor = await fetchItems('EstimateLineItemsSubcontractor');
            est.disposal = await fetchItems('EstimateLineItemsDisposal');
            est.miscellaneous = await fetchItems('EstimateLineItemsMiscellaneous');
        }

        return est;
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

        console.log(`Deleted estimate from AppSheet webhook: ${idToUse}`);
        return {
            message: 'Estimate deleted successfully',
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
        const result = await Model.create(data);

        return {
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

        data.updatedAt = new Date();
        const result = await Model.findByIdAndUpdate(id, data, { new: true });

        if (!result) throw new Error("Item not found");

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
