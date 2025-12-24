

const APPSHEET_APP_ID = process.env.NCSTAFFAPPSHEET_APP_ID;
const APPSHEET_ACCESS = process.env.NCSTAFFAPPSHEET_ACCESS;
const APPSHEET_TABLE = "Leaves Bucket";
const RUN_AS_USER_EMAIL = "admin@aivisualpro.com";


export default async function ncStaffLeaveBucketzHCRxhCl(payload) {
    const startedAt = Date.now();

    try {
        if (!payload || typeof payload !== "object") {
            throw new Error("Payload is missing or not an object");
        }

        logRow("INFO", "Received payload", shorten(payload));

        const timeSheetData = Array.isArray(payload.timeSheetData)
            ? payload.timeSheetData
            : [];

        const leaveTypeRaw = payload.leaveType ?? payload.LeaveType ?? "";
        const bonusPerhoursRaw = payload.bonusPerhours ?? payload.bonusPerHours ?? payload.BonusPerHours;
        const bonusHoursRaw = payload.bonushours ?? payload.bonusHours ?? payload.BonusHours;

        const leaveType = String(leaveTypeRaw || "").trim();
        const bonusPerhours = toNum(bonusPerhoursRaw);
        const bonusHours = toNum(bonusHoursRaw);

        if (!leaveType) {
            throw new Error("leaveType is required");
        }
        if (bonusPerhours <= 0) {
            throw new Error(`bonusPerhours must be > 0, got "${bonusPerhoursRaw}"`);
        }
        if (bonusHours <= 0) {
            throw new Error(`bonushours must be > 0, got "${bonusHoursRaw}"`);
        }

        // 1) Sum hours per staff
        const staffTotals = new Map(); // Staff -> totalHours
        for (const row of timeSheetData) {
            const staff = String(row.Staff || row.staff || "").trim();
            if (!staff) continue;

            const hrs = toNum(row.Hours ?? row.hours ?? row.DurationInDecimals);
            if (!staffTotals.has(staff)) staffTotals.set(staff, 0);
            staffTotals.set(staff, staffTotals.get(staff) + hrs);
        }

        // 2) Build rows for AppSheet "Leaves Bucket"
        const today = new Date();
        const todayStr = toMDY(today);

        const rows = [];
        for (const [staff, totalHours] of staffTotals.entries()) {
            if (totalHours <= 0) continue;

            // Formula: (sum Hours / bonusPerhours) * bonushours
            const earned = round2((totalHours / bonusPerhours) * bonusHours);

            // If zero or negative, skip
            if (earned <= 0) continue;

            rows.push({
                Staff: staff,
                Date: todayStr,           // today's date
                "Leave Type": leaveType,  // e.g. "Sick Leave"
                Hours: earned
            });
        }

        if (!rows.length) {
            logRow("INFO", "No rows to add to Leaves Bucket (no positive earned hours)", "");
            const finishedAt = Date.now();
            return {
                ok: true,
                added: 0,
                ms: finishedAt - startedAt,
                detail: "No staff qualified for bonus hours"
            };
        }

        logRow("INFO", `Prepared ${rows.length} rows for Leaves Bucket`, shorten(rows));

        // 3) Call AppSheet Add
        const appRes = await appsheetInvoke(APPSHEET_TABLE, "Add", rows);

        const finishedAt = Date.now();
        const summary = {
            ok: true,
            added: rows.length,
            leaveType,
            bonusPerhours,
            bonushours: bonusHours,
            ms: finishedAt - startedAt,
            appSheetStatus: appRes?.Status ?? "OK",
            raw: appRes
        };

        logRow("INFO", "leaveBucket completed", shorten(summary));
        return summary;
    } catch (err) {
        logRow("ERROR", "leaveBucket failed", String(err?.stack || err));
        return { ok: false, error: String(err?.message || err) };
    }
}

/*********************************
 * APPSHEET HTTP
 *********************************/

async function appsheetInvoke(tableName, action, rows, properties) {
    if (!APPSHEET_APP_ID || !APPSHEET_ACCESS) {
        throw new Error(
            "AppSheet env vars NCSTAFFAPPSHEET_APP_ID / NCSTAFFAPPSHEET_ACCESS not set"
        );
    }

    const url = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(
        APPSHEET_APP_ID
    )}/tables/${encodeURIComponent(tableName)}/Action`;

    const body = {
        Action: action, // 'Add'
        Properties: {
            Locale: "en-US",
            Timezone: "Central Standard Time",
            RunAsUserEmail: RUN_AS_USER_EMAIL,   // 👈 **this line is the key**
            UserSettings: {},
            ...(properties || {})
        },
        Rows: rows
    };

    const resp = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ApplicationAccessKey: APPSHEET_ACCESS,
            ApplicationId: APPSHEET_APP_ID,
            Accept: "application/json"
        },
        body: JSON.stringify(body)
    });

    const txt = await resp.text();
    logRow("INFO", `API ${action} status ${resp.status}`, shorten(txt));

    try {
        return txt ? JSON.parse(txt) : { Status: resp.status, Raw: "" };
    } catch (e) {
        return { Status: resp.status, Raw: txt };
    }
}


/*********************************
 * UTILS
 *********************************/

function toNum(v) {
    const s = String(v == null ? "" : v).trim();
    if (!s) return 0;
    const cleaned = s.replace(/[^0-9.\-]/g, "");
    const n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
}

function round2(n) {
    return Math.round(n * 100) / 100;
}

function toMDY(d) {
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
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
        `[${new Date().toISOString()}] [${level}] ${message}${
            details ? " :: " + details : ""
        }`
    );
}
