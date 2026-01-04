// scripts/munchofm.js
import "dotenv/config";
import { google } from "googleapis";

// === CONFIG ===
const APPSHEET_APP_ID = process.env.MUNCHOFMAPPSHEET_APP_ID;
const APPSHEET_ACCESS = process.env.MUNCHOFMAPPSHEET_ACCESS;

// Root Google Drive folder where "Models/..." lives
// Either set this in .env or we fall back to the ID you gave.
const ROOT_FOLDER_ID =
    process.env.MUNCHOFM_DRIVE_ROOT_ID ||
    "1CSGPt4RR7xiN4p38QcwDvzI_uF3S2IM3"; // <-- your Models root

// AppSheet table to write folder links into
const APPSHEET_TABLE = "Content";

// =========================================
// MAIN ENTRYPOINT (called by server.js)
// =========================================
export default async function munchofm(payload) {
    const startedAt = Date.now();

    try {
        validateEnv();
        validatePayload(payload);

        logRow("INFO", "Received payload", shorten(payload));

        const recordNo = String(payload.recordNo || "").trim();
        const requestId = String(payload.requestId || "").trim();
        const category = String(payload.category || "").trim();

        const modelNames = splitCsv(payload.modelNames);
        const modelIds = splitCsv(payload.modelsIds);

        if (!modelNames.length || !modelIds.length) {
            throw new Error("modelNames or modelsIds is empty after splitting");
        }

        const count = Math.min(modelNames.length, modelIds.length);

        const drive = await getDriveClient();
        const rowsForAppsheet = [];
        const createdFolders = [];

        for (let i = 0; i < count; i++) {
            const name = modelNames[i];
            const email = modelIds[i];

            // 1) subfolder under ROOT: "Name-email"
            const modelFolderName = `${name}-${email}`;
            const modelFolder = await ensureFolder(drive, modelFolderName, ROOT_FOLDER_ID);

            // 2) inside that: category folder (e.g. "Social Media")
            const categoryFolder = await ensureFolder(drive, category, modelFolder.id);

            // 3) inside that: recordNo folder (e.g. "25-000001")
            const recordFolder = await ensureFolder(drive, recordNo, categoryFolder.id);
            await drive.permissions.create({
                fileId: recordFolder.id,
                requestBody: {
                    role: "writer",  // allows uploading & editing
                    type: "user",
                    emailAddress: email,
                },
                fields: "id",
            });

            const folderLink = `https://drive.google.com/drive/folders/${recordFolder.id}`;

            createdFolders.push({
                modelName: name,
                modelId: email,
                folderId: recordFolder.id,
                folderLink,
            });

            // Prepare row for AppSheet Content table
            rowsForAppsheet.push({
                RequestID: requestId,
                Model: email, // email for this model
                folderLink: folderLink,
            });
        }

        // === PUSH TO APPSHEET ===
        let appsheetRes = null;
        if (rowsForAppsheet.length) {
            appsheetRes = await appsheetInvoke(APPSHEET_TABLE, "Add", rowsForAppsheet);
            logRow(
                "INFO",
                `AppSheet Add to ${APPSHEET_TABLE}`,
                shorten({ count: rowsForAppsheet.length, res: appsheetRes })
            );
        } else {
            logRow("INFO", "No rows to add to AppSheet (rowsForAppsheet empty)", "");
        }

        const finishedAt = Date.now();
        const summary = {
            ok: true,
            ms: finishedAt - startedAt,
            requestId,
            recordNo,
            category,
            modelsProcessed: count,
            folders: createdFolders,
            appsheetStatus: appsheetRes?.Status || "OK",
        };

        logRow("INFO", "munchofm completed", shorten(summary));
        return summary;
    } catch (err) {
        logRow("ERROR", "munchofm failed", String(err?.stack || err));
        return {
            ok: false,
            error: String(err?.message || err),
        };
    }
}

// =========================================
// VALIDATION
// =========================================

function validateEnv() {
    if (!APPSHEET_APP_ID || !APPSHEET_ACCESS) {
        throw new Error(
            "Env vars MUNCHOFMAPPSHEET_APP_ID / MUNCHOFMAPPSHEET_ACCESS are required"
        );
    }
    if (!ROOT_FOLDER_ID) {
        throw new Error("ROOT_FOLDER_ID (MUNCHOFM_DRIVE_ROOT_ID) is required");
    }
}

function validatePayload(payload) {
    if (!payload || typeof payload !== "object") {
        throw new Error("Payload is missing or not an object");
    }

    const required = ["recordNo", "requestId", "category", "modelNames", "modelsIds"];
    for (const key of required) {
        if (!payload[key]) {
            throw new Error(`Payload missing required field: ${key}`);
        }
    }
}

// =========================================
// GOOGLE DRIVE HELPERS
// =========================================

async function getDriveClient() {
    const raw = process.env.MUNCHOFM_GOOGLE_APPLICATION_CREDENTIALS;
    if (!raw) {
        throw new Error("MUNCHOFM_GOOGLE_APPLICATION_CREDENTIALS env var is missing");
    }

    // Try: treat value as JSON credentials
    try {
        const credentials = JSON.parse(raw);

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/drive"],
        });

        return google.drive({ version: "v3", auth });
    } catch (e) {
        // Not valid JSON => treat as file path
        const keyFile = raw;
        const auth = new google.auth.GoogleAuth({
            keyFilename: keyFile,
            scopes: ["https://www.googleapis.com/auth/drive"],
        });

        return google.drive({ version: "v3", auth });
    }
}





/**
 * Ensure a folder exists with given name under a parent folder.
 * If exists, returns that folder; otherwise creates it.
 */
async function ensureFolder(drive, name, parentId) {
    const safeName = name.trim();
    if (!safeName) {
        throw new Error("ensureFolder: folder name is empty");
    }

    // 1) Look for existing folder
    const listRes = await drive.files.list({
        q: [
            `'${parentId}' in parents`,
            `name = '${safeName.replace(/'/g, "\\'")}'`,
            "mimeType = 'application/vnd.google-apps.folder'",
            "trashed = false",
        ].join(" and "),
        fields: "files(id, name)",
        spaces: "drive",
    });

    if (listRes.data.files && listRes.data.files.length > 0) {
        return listRes.data.files[0];
    }

    // 2) Create new folder
    const createRes = await drive.files.create({
        requestBody: {
            name: safeName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentId],
        },
        fields: "id, name",
    });

    return createRes.data;
}

// =========================================
// APPSHEET HELPERS
// =========================================

async function appsheetInvoke(tableName, action, rows, properties) {
    const url = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(
        APPSHEET_APP_ID
    )}/tables/${encodeURIComponent(tableName)}/Action`;

    const body = {
        Action: action, // 'Add' | 'Edit' | 'Find'
        Properties: {
            Locale: "en-US",
            Timezone: "Pacific Standard Time",
            UserSettings: {},
            ...(properties || {}),
        },
        Rows: rows,
    };

    const resp = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ApplicationAccessKey: APPSHEET_ACCESS,
            ApplicationId: APPSHEET_APP_ID,
            Accept: "application/json",
        },
        body: JSON.stringify(body),
    });

    const txt = await resp.text();
    logRow("INFO", `AppSheet API ${action} status ${resp.status}`, shorten(txt));

    try {
        return txt ? JSON.parse(txt) : { Status: resp.status, Raw: "" };
    } catch (e) {
        return { Status: resp.status, Raw: txt };
    }
}

// =========================================
/** UTILITIES */
// =========================================

function splitCsv(str) {
    if (!str) return [];
    return String(str)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

function shorten(objOrStr, max = 750) {
    const s = typeof objOrStr === "string" ? objOrStr : JSON.stringify(objOrStr);
    return s.length > max ? s.slice(0, max) + "…" : s;
}

function logRow(level, message, details) {
    if (details && typeof details !== "string") {
        try {
            details = JSON.stringify(details);
        } catch {
            details = String(details);
        }
    }
    console.log(
        `[${new Date().toISOString()}] [${level}] ${message}${details ? " :: " + details : ""
        }`
    );
}
