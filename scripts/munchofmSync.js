// scripts/munchofmSync.js
import "dotenv/config";
import { google } from "googleapis";

// === CONFIG ===
const APPSHEET_APP_ID = process.env.MUNCHOFMAPPSHEET_APP_ID;
const APPSHEET_ACCESS = process.env.MUNCHOFMAPPSHEET_ACCESS;

// Same service-account env as munchofm.js
const SA_CREDENTIALS_RAW = process.env.MUNCHOFM_GOOGLE_APPLICATION_CREDENTIALS;

// AppSheet table to sync FILES into
// Make sure table name is exactly "Content Data"
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
 *  - WIPES all rows in "Content Data" where [ContentID] = contentId (Delete by Selector)
 *  - Re-adds one row per file:
 *      ContentID
 *      fileurl
 *      fileName   (Key column in AppSheet)
 *      type       (image, video, pdf, zip, other)
 *      timestamp  (MM/DD/YYYY HH:MM)
 *      uploadedby
 *  - Updates "Content" table [Sync Summary] by APPENDING a line if Find works,
 *    otherwise overwrites (because AppSheet isn't letting the API read).
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

        // Build rows from Drive
        const driveRows = driveFiles.map((f) => buildFileInfoForRow(f, contentId));

        // 2) DELETE ALL existing rows in Content Data for this ContentID
        const selector = `([ContentID] = "${escapeQuotes(contentId)}")`;
        logRow("INFO", "Deleting existing rows in Content Data with selector", selector);

        const deleteRes = await appsheetInvoke(APPSHEET_TABLE, "Delete", [], {
            Selector: selector,
        });
        logRow("INFO", "Delete-by-selector result", shorten(deleteRes));

        // We don't know exactly how many were deleted (AppSheet doesn't return a count),
        // but we can assume that anything not in Drive now is gone in the table.
        // For summary, we'll just show Deleted = (oldCount - newCount) if we can read,
        // otherwise we approximate as 0.
        let deletedCount = 0;

        // Try to approximate deletedCount using Content row's Related Content Datas BEFORE Add
        // (if AppSheet ever lets us read).
        try {
            const beforeRes = await appsheetFind("Content", selector);
            const beforeRows = getRowsArray(beforeRes);
            if (beforeRows.length) {
                const r = beforeRows[0];
                const related =
                    r["Related Content Datas"] ||
                    r.RelatedContentDatas ||
                    "";
                if (related && typeof related === "string") {
                    const parts = related
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                    deletedCount = Math.max(0, parts.length - driveFiles.length);
                }
            }
        } catch (e) {
            logRow("WARN", "Could not estimate deletedCount", String(e));
        }

        // 3) ADD all current Drive files
        let addsCount = 0;
        if (driveRows.length) {
            const addRes = await appsheetInvoke(APPSHEET_TABLE, "Add", driveRows);
            addsCount = driveRows.length;
            logRow("INFO", `AppSheet Add ${driveRows.length} rows`, shorten(addRes));
        } else {
            logRow("INFO", "No rows to Add (folder empty)", "");
        }

        // 4) Update Sync Summary row in Content table (APPEND if Find works)
        await updateSyncSummary(contentId, addsCount, deletedCount);

        const finishedAt = Date.now();
        const summary = {
            ok: true,
            ms: finishedAt - startedAt,
            contentId,
            folderId,
            driveFileCount: driveFiles.length,
            adds: addsCount,
            deletes: deletedCount,
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
 *  - finds row by ContentID (Key)
 *  - APPENDS a new line when Find works
 *  - If Find returns nothing (like now), it just overwrites with the latest line.
 */
async function updateSyncSummary(contentId, added, deleted) {
    const nowIso = new Date().toISOString();
    const stamp = formatTimestamp(nowIso);

    const newLine = `timestamp: ${stamp} | Summary: Added ${added} file(s), Deleted ${deleted} file(s)`;

    let existingSummary = "";

    try {
        const selector = `([ContentID] = "${escapeQuotes(contentId)}")`;
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
        ContentID: contentId,
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
