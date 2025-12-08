// scripts/munchofmSync.js
import "dotenv/config";
import { google } from "googleapis";

// === CONFIG ===
const APPSHEET_APP_ID = process.env.MUNCHOFMAPPSHEET_APP_ID;
const APPSHEET_ACCESS = process.env.MUNCHOFMAPPSHEET_ACCESS;

// Same service-account env as munchofm.js
const SA_CREDENTIALS_RAW = process.env.MUNCHOFM_GOOGLE_APPLICATION_CREDENTIALS;

// AppSheet table to sync FILES into
const APPSHEET_TABLE = "Content Data";

/**
 * Payload expected:
 * {
 *   "contentId": "<<[ContentID]>>",
 *   "folderLink": "<<[folderLink]>>"
 * }
 *
 * Behavior:
 *  - Reads all files in the Drive folder
 *  - Diff vs "Content Data" rows (for this ContentID):
 *      * Add new files
 *      * Edit changed files
 *      * Delete rows for files that no longer exist
 *  - Updates "Content" table [Sync Summary] by APPENDING a line:
 *      "timestamp: ... | Summary: Added X file(s), Deleted Y file(s)"
 */
export default async function munchofmSync(payload) {
    const startedAt = Date.now();

    try {
        validateEnv();
        validatePayload(payload);

        logRow("INFO", "Sync payload received", shorten(payload));

        const contentId = String(payload.contentId || "").trim();
        const folderLink = String(payload.folderLink || "").trim();

        const folderId = extractFolderIdFromLink(folderLink);
        if (!folderId) {
            throw new Error(`Could not extract folderId from folderLink: ${folderLink}`);
        }
        logRow("INFO", "Using folderId", folderId);

        const drive = await getDriveClient();

        // 1) List current files in the Drive folder
        const driveFiles = await listFilesInFolder(drive, folderId);
        logRow(
            "INFO",
            "Drive files fetched",
            `count=${driveFiles.length} :: names=${shorten(driveFiles.map((f) => f.name))}`
        );

        // Map Drive -> by fileName
        const driveMap = {};
        for (const f of driveFiles) {
            const fileName = f.name;
            if (!fileName) continue;
            const row = buildFileInfoForRow(f, contentId);
            driveMap[fileName] = row;
        }

        // 2) Get existing AppSheet rows for this ContentID
        // IMPORTANT: use Filter("Content Data", ...) rather than a bare boolean selector
        const selectorCD = `Filter("Content Data", [ContentID] = "${escapeQuotes(
            contentId
        )}")`;
        const existingRes = await appsheetFind(APPSHEET_TABLE, selectorCD);
        const existingRows = getRowsArray(existingRes);
        logRow(
            "INFO",
            "Existing AppSheet rows fetched",
            `count=${existingRows.length}`
        );

        // Map existing -> by fileName (Key)
        const appMap = {};
        for (const row of existingRows) {
            const fn =
                row.fileName ||
                row.FileName ||
                row["file name"] ||
                row["fileName"] ||
                "";
            const fileName = String(fn || "").trim();
            if (!fileName) continue;
            appMap[fileName] = row;
        }

        // 3) Diff: adds, edits, deletes
        const adds = [];
        const edits = [];
        const deletes = [];

        // Adds + edits
        for (const [fileName, driveRow] of Object.entries(driveMap)) {
            const existing = appMap[fileName];
            if (!existing) {
                adds.push(driveRow);
            } else {
                const diff = buildEditDiff(driveRow, existing);
                if (diff) edits.push(diff);
            }
        }

        // Deletes: rows existing in AppSheet but not in Drive anymore
        for (const [fileName, existing] of Object.entries(appMap)) {
            if (!driveMap[fileName]) {
                deletes.push(buildDeleteRow(fileName)); // row with Key
            }
        }

        logRow(
            "INFO",
            "Diff summary",
            `adds=${adds.length}, edits=${edits.length}, deletes=${deletes.length}`
        );
        if (deletes.length) {
            logRow(
                "INFO",
                "Delete candidates (fileName keys)",
                deletes.map((d) => d.fileName)
            );
        }

        const results = [];

        if (adds.length) {
            const addRes = await appsheetInvoke(APPSHEET_TABLE, "Add", adds);
            results.push({ type: "Add", count: adds.length, raw: addRes });
            logRow("INFO", `AppSheet Add ${adds.length} rows`, shorten(addRes));
        } else {
            logRow("INFO", "No rows to Add", "");
        }

        if (edits.length) {
            const editRes = await appsheetInvoke(APPSHEET_TABLE, "Edit", edits);
            results.push({ type: "Edit", count: edits.length, raw: editRes });
            logRow("INFO", `AppSheet Edit ${edits.length} rows`, shorten(editRes));
        } else {
            logRow("INFO", "No rows to Edit", "");
        }

        if (deletes.length) {
            const delRes = await appsheetInvoke(APPSHEET_TABLE, "Delete", deletes);
            results.push({ type: "Delete", count: deletes.length, raw: delRes });
            logRow("INFO", `AppSheet Delete ${deletes.length} rows`, shorten(delRes));
        } else {
            logRow("INFO", "No rows to Delete", "");
        }

        // 4) Update Sync Summary row in Content table (APPEND)
        await updateSyncSummary(contentId, adds.length, deletes.length);

        const finishedAt = Date.now();
        const summary = {
            ok: true,
            ms: finishedAt - startedAt,
            contentId,
            folderId,
            driveFileCount: driveFiles.length,
            adds: adds.length,
            edits: edits.length,
            deletes: deletes.length,
            results,
        };

        logRow("INFO", "munchofmSync completed", shorten(summary));
        return summary;
    } catch (err) {
        logRow("ERROR", "munchofmSync failed", String(err?.stack || err));
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
    if (!SA_CREDENTIALS_RAW) {
        throw new Error(
            "MUNCHOFM_GOOGLE_APPLICATION_CREDENTIALS env var is required (JSON or file path)"
        );
    }
}

function validatePayload(payload) {
    if (!payload || typeof payload !== "object") {
        throw new Error("Payload is missing or not an object");
    }

    const required = ["contentId", "folderLink"];
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
    const raw = SA_CREDENTIALS_RAW;

    // Try parse as JSON first
    try {
        const credentials = JSON.parse(raw);

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/drive"],
        });

        return google.drive({ version: "v3", auth });
    } catch {
        // Not JSON → treat as key filename/path
        const auth = new google.auth.GoogleAuth({
            keyFilename: raw,
            scopes: ["https://www.googleapis.com/auth/drive"],
        });

        return google.drive({ version: "v3", auth });
    }
}

/**
 * Extract folderId from a Drive folder link
 */
function extractFolderIdFromLink(link) {
    if (!link) return null;
    const url = String(link);

    let m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];

    m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];

    return null;
}

async function listFilesInFolder(drive, folderId) {
    const out = [];
    let pageToken = undefined;

    do {
        const res = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            spaces: "drive",
            fields:
                "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, webViewLink, owners(emailAddress,displayName), imageMediaMetadata)",
            pageSize: 1000,
            pageToken,
        });

        if (res.data.files && res.data.files.length) {
            out.push(...res.data.files);
        }
        pageToken = res.data.nextPageToken;
    } while (pageToken);

    return out;
}

// Build MM/DD/YYYY HH:MM string
function formatTimestamp(ts) {
    const d = new Date(ts);
    if (isNaN(d.getTime())) {
        return ""; // invalid date
    }

    const pad = (n) => (n < 10 ? "0" + n : "" + n);

    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const yyyy = d.getFullYear();
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());

    return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
}

/**
 * Decide type from mimeType.
 * Returns: image | video | pdf | zip | other
 */
function decideType(mime) {
    if (!mime) return "other";
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime === "application/pdf") return "pdf";
    if (
        mime === "application/zip" ||
        mime === "application/x-zip-compressed" ||
        mime === "application/x-zip"
    )
        return "zip";
    return "other";
}

/**
 * Build a row object for AppSheet Content Data table from a Drive file.
 */
function buildFileInfoForRow(file, contentId) {
    const fileId = file.id;
    const fileName = file.name;
    const mime = file.mimeType || "";
    const webViewLink =
        file.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    const type = decideType(mime);

    // Prefer metadata time, then created/modified
    let rawTs =
        file.imageMediaMetadata?.time ||
        file.createdTime ||
        file.modifiedTime ||
        new Date().toISOString();

    let ts = rawTs;
    try {
        ts = new Date(rawTs).toISOString();
    } catch {
        // keep as-is
    }
    const timestampStr = formatTimestamp(ts);

    const ownerEmail =
        (file.owners && file.owners[0]?.emailAddress) || "";

    return {
        ContentID: contentId,
        fileurl: webViewLink,
        fileName: fileName,
        type: type,
        timestamp: timestampStr,
        uploadedby: ownerEmail,
    };
}

/**
 * Build partial row for Edit if any relevant fields changed.
 * Key column is fileName.
 */
function buildEditDiff(newRow, existingRow) {
    const key =
        existingRow.fileName ||
        existingRow.FileName ||
        existingRow["file name"] ||
        existingRow["fileName"] ||
        newRow.fileName;

    const diff = { fileName: key }; // Key column

    let changed = false;

    function cmp(colKey, newVal) {
        const oldVal =
            existingRow[colKey] ??
            existingRow[colKey.replace(/ /g, "")] ??
            existingRow[colKey.replace(/ /g, "_")];
        const oldStr = oldVal == null ? "" : String(oldVal);
        const newStr = newVal == null ? "" : String(newVal);
        if (oldStr !== newStr) {
            diff[colKey] = newVal;
            changed = true;
        }
    }

    cmp("ContentID", newRow.ContentID);
    cmp("fileurl", newRow.fileurl);
    cmp("type", newRow.type);
    cmp("timestamp", newRow.timestamp);
    cmp("uploadedby", newRow.uploadedby);

    return changed ? diff : null;
}

/**
 * Build row for Delete.
 * IMPORTANT: this assumes the Key column in "Content Data" is [fileName].
 */
function buildDeleteRow(fileName) {
    return {
        fileName: fileName, // key column MUST be fileName in AppSheet
    };
}

// =========================================
// APPSHEET HELPERS
// =========================================

async function appsheetInvoke(tableName, action, rows, properties) {
    const url = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(
        APPSHEET_APP_ID
    )}/tables/${encodeURIComponent(tableName)}/Action`;

    const body = {
        Action: action, // 'Add' | 'Edit' | 'Delete' | 'Find'
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

async function appsheetFind(tableName, selectorExpr) {
    const url = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(
        APPSHEET_APP_ID
    )}/tables/${encodeURIComponent(tableName)}/Action`;

    const body = {
        Action: "Find",
        Properties: {
            Selector: selectorExpr,
        },
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
    logRow(
        "INFO",
        `AppSheet API Find status ${resp.status}`,
        `Selector=${selectorExpr} :: ${shorten(txt)}`
    );

    if (!txt.trim()) return { Rows: [] };
    try {
        return JSON.parse(txt);
    } catch (e) {
        logRow("WARN", "Find JSON parse failed, returning no rows", String(e));
        return { Rows: [] };
    }
}

/**
 * Update Sync Summary in Content table:
 *  - uses Filter("Content", [ContentID] = "...") to read existing summary
 *  - APPENDS a new line
 */
async function updateSyncSummary(contentId, added, deleted) {
    const nowIso = new Date().toISOString();
    const stamp = formatTimestamp(nowIso);

    const newLine = `timestamp: ${stamp} | Summary: Added ${added} file(s), Deleted ${deleted} file(s)`;

    let existingSummary = "";

    try {
        const selector = `Filter("Content", [ContentID] = "${escapeQuotes(contentId)}")`;
        const findRes = await appsheetFind("Content", selector);
        const rows = getRowsArray(findRes);

        if (rows.length) {
            const r = rows[0];
            existingSummary =
                r["Sync Summary"] ||
                r.SyncSummary ||
                "";
        }
    } catch (e) {
        logRow("WARN", "Could not read existing Sync Summary", String(e));
    }

    const combined =
        existingSummary && existingSummary.trim().length
            ? `${existingSummary}\n${newLine}`
            : newLine;

    const row = {
        ContentID: contentId,     // key column in Content table
        "Sync Summary": combined,
    };

    const res = await appsheetInvoke("Content", "Edit", [row]);
    logRow("INFO", "Updated Sync Summary on Content", shorten(res));
}

// =========================================
// UTILITIES
// =========================================

function escapeQuotes(s) {
    return String(s).replace(/"/g, '\\"');
}

function getRowsArray(findRes) {
    if (!findRes) return [];
    if (Array.isArray(findRes)) return findRes;
    if (Array.isArray(findRes.Rows)) return findRes.Rows;
    if (Array.isArray(findRes.rows)) return findRes.rows;
    if (Array.isArray(findRes.Items)) return findRes.Items;
    if (Array.isArray(findRes.items)) return findRes.items;
    if (Array.isArray(findRes.Data)) return findRes.Data;
    if (Array.isArray(findRes.data)) return findRes.data;
    return [];
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
