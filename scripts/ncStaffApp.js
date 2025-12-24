// scripts/ncStaffApp.js

// CONFIG
const APPSHEET_APP_ID = process.env.NCSTAFFAPPSHEET_APP_ID;
const APPSHEET_ACCESS = process.env.NCSTAFFAPPSHEET_ACCESS;
const APPSHEET_TABLE = "Payroll";

// Toggle existing week totals
const USE_EXISTING_WEEK_TOTALS = true;


export default async function ncStaffApp(payload) {
    const startedAt = Date.now();

    try {
        if (!payload || typeof payload !== "object") {
            throw new Error("Payload is missing or not an object");
        }

        logRow("INFO", "Received payload", shorten(payload));

        const time = Array.isArray(payload.timeSheetData) ? payload.timeSheetData : [];
        const lunch = Array.isArray(payload.lunchSheetData) ? payload.lunchSheetData : [];
        const leave = Array.isArray(payload.leaveSheetData) ? payload.leaveSheetData : [];

        // 1) Aggregate Staff-Date (includes leave buckets)
        const merged = mergeAndSumByStaffDate(time, lunch, leave);

        // 2) Week totals from existing, if enabled
        let existingWeekTotals = {};
        if (USE_EXISTING_WEEK_TOTALS) {
            const staffWeekKeys = collectStaffWeeks(merged);
            existingWeekTotals = await fetchExistingWeekTotals(staffWeekKeys);
        } else {
            logRow("INFO", "Skipping existing week totals (flag off)", "");
        }

        // 3) Allocate Regular/Overtime with 40h weekly cap (Sun→Sat) – leave hours DO NOT affect this
        allocateRegularOvertime(merged, existingWeekTotals);

        // 4) Compute Amount on daily rows (needs Regular/Overtime first)
        computeDailyAmounts(merged);

        // 5) Append per-Staff per-Month (payload) totals rows
        const withTotals = appendStaffMonthlyTotals(merged);

        // 6) Split adds vs edits by probing existing Record IDs
        const { adds, edits } = await splitAddsEditsByExisting(withTotals);

        // 7) Upserts
        const results = [];

        if (adds.length) {
            const resAdd = await appsheetInvoke(APPSHEET_TABLE, "Add", adds);
            results.push({
                type: "Add",
                count: adds.length,
                status: resAdd?.Status || "OK",
                raw: resAdd,
            });
            logRow("INFO", `Bulk Add ${adds.length}`, shorten(resAdd));
        } else {
            logRow("INFO", "No rows to Add", "");
        }

        if (edits.length) {
            const resEdit = await appsheetInvoke(APPSHEET_TABLE, "Edit", edits);
            results.push({
                type: "Edit",
                count: edits.length,
                status: resEdit?.Status || "OK",
                raw: resEdit,
            });
            logRow("INFO", `Bulk Edit ${edits.length}`, shorten(resEdit));
        } else {
            logRow("INFO", "No rows to Edit", "");
        }

        const finishedAt = Date.now();
        const summary = {
            adds: adds.length,
            edits: edits.length,
            ms: finishedAt - startedAt,
        };

        logRow("INFO", "Completed upsert", JSON.stringify(summary));

        // In Node we just return a JSON-friendly object; Express will send it as response.
        return { ok: true, ...summary, results };
    } catch (err) {
        logRow("ERROR", "ncStaffApp failed", String(err?.stack || err));
        return { ok: false, error: String(err?.message || err) };
    }
}

/*********************************
 * AGGREGATION & COMPUTATION
 *********************************/

function mergeAndSumByStaffDate(timeArr, lunchArr, leaveArr) {
    const map = new Map(); // key: staff|dateStr -> object

    const ensureBucket = (obj) => {
        const staff = String(obj.Staff || "").trim();
        const dateStr = String(obj.Date || "").trim(); // expected M/D/YYYY
        if (!staff || !dateStr) return null;

        // Custom Month from payload (e.g., "2025-Aug"); fallback to YYYY-MMM from date
        const customMonthRaw = String(obj.Month || obj.PayrollMonth || "").trim();
        const d = parseMDY(dateStr);
        const monthToken = customMonthRaw || `${d.getFullYear()}-${monthShortName(d.getMonth())}`;
        const yearFromMonthToken = parseYearFromMonthToken(monthToken) ?? d.getFullYear();

        const key = `${staff}|${dateStr}`;
        if (!map.has(key)) {
            const dayNum = d.getDate();
            const workday = weekdayName(d.getDay());
            const week = weekNumberSunday(d); // Sunday-start week number

            map.set(key, {
                "Record ID": `${staff}-${dateStr}`, // per-day
                Staff: staff,
                Date: dateStr,
                Year: yearFromMonthToken, // from payload month when present
                Month: monthToken, // exact token like "2025-Aug"
                Week: week,
                Day: dayNum,
                Workday: workday,
                "Hours in Office": 0,
                "Hours in Lunch": 0,
                "Net Hours": 0,
                Regular: 0,
                Overtime: 0,
                "Hourly Rate": 0, // from payload, if provided

                // Leave buckets
                "Sick Hrs": 0,
                "Holiday Hrs": 0,
                "Vacation Hrs": 0,
                "Funeral Leave": 0,
                "Personal Leave": 0,
                "Leave Without Pay": 0,

                // Money
                Amount: 0,
            });
        }
        return map.get(key);
    };

    // 1) Time (worked) -> Hours in Office
    for (const o of timeArr) {
        const b = ensureBucket(o);
        if (!b) continue;
        b["Hours in Office"] += toNum(o.Hours);
        const hrRate = toNum(o.HourlyRate ?? o.HourlyRate ?? o["Hourly Rate"]);
        if (hrRate > 0) b["Hourly Rate"] = hrRate;
    }

    // 2) Lunch -> Hours in Lunch
    for (const o of lunchArr) {
        const b = ensureBucket(o);
        if (!b) continue;
        b["Hours in Lunch"] += toNum(o.Hours);
        const hrRate = toNum(o.HourlyRate ?? o.HourlyRate ?? o["Hourly Rate"]);
        if (hrRate > 0) b["Hourly Rate"] = hrRate;
    }

    // 3) Leave -> add to specific leave bucket; DOES NOT change Net/Regular/Overtime
    for (const o of leaveArr) {
        const b = ensureBucket(o);
        if (!b) continue;
        const hrs = toNum(o.Hours);
        const hrRate = toNum(o.HourlyRate ?? o.HourlyRate ?? o["Hourly Rate"]);
        if (hrRate > 0) b["Hourly Rate"] = hrRate;

        const rawType = String(o.LeaveType ?? o["Leave Type"] ?? o.Type ?? "")
            .trim()
            .toLowerCase();
        let colName = null;
        if (/^sick/.test(rawType)) colName = "Sick Hrs";
        else if (/^holiday/.test(rawType)) colName = "Holiday Hrs";
        else if (/^vacation/.test(rawType)) colName = "Vacation Hrs";
        else if (/^funeral/.test(rawType)) colName = "Funeral Leave";
        else if (/^personal/.test(rawType)) colName = "Personal Leave";
        // LWP mapping (handles “Leave Without Pay”, “LWP”, “unpaid”)
        else if (
            /^leave\s*without\s*pay/.test(rawType) ||
            /\bLWP\b/i.test(o.LeaveType || "") ||
            /\bunpaid\b/.test(rawType)
        )
            colName = "Leave Without Pay";
        else colName = "Personal Leave"; // default if unknown

        b[colName] += hrs;
    }

    // 4) Compute Net (worked) hours = Office - Lunch   (leave does NOT affect Net)
    for (const b of map.values()) {
        b["Hours in Office"] = round2(b["Hours in Office"]);
        b["Hours in Lunch"] = round2(b["Hours in Lunch"]);
        b["Net Hours"] = round2(Math.max(0, b["Hours in Office"] - b["Hours in Lunch"]));

        // Normalize leave buckets to 2 decimals
        b["Sick Hrs"] = round2(b["Sick Hrs"]);
        b["Holiday Hrs"] = round2(b["Holiday Hrs"]);
        b["Vacation Hrs"] = round2(b["Vacation Hrs"]);
        b["Funeral Leave"] = round2(b["Funeral Leave"]);
        b["Personal Leave"] = round2(b["Personal Leave"]);
        b["Leave Without Pay"] = round2(b["Leave Without Pay"]);
    }

    const merged = Array.from(map.values());
    logRow("INFO", "Merged rows (with leave)", shorten(merged));
    return merged;
}

function collectStaffWeeks(rows) {
    const set = new Set();
    for (const r of rows) set.add(`${r.Staff}|${r.Year}|${r.Week}`);
    return Array.from(set);
}

function allocateRegularOvertime(rows, existingWeekTotals) {
    // group by staff-week and allocate in date order
    const groups = {};
    rows.forEach((r) => {
        const k = `${r.Staff}|${r.Year}|${r.Week}`;
        if (!groups[k]) groups[k] = [];
        groups[k].push(r);
    });

    for (const [k, arr] of Object.entries(groups)) {
        arr.sort((a, b) => parseMDY(a.Date) - parseMDY(b.Date));
        const carryStart = existingWeekTotals[k]?.totalNet || 0;
        let weekRunning = carryStart;

        for (const r of arr) {
            const net = Math.max(0, toNum(r["Net Hours"])); // only worked net hours
            const remainingRegular = Math.max(0, 40 - weekRunning);
            const regular = Math.min(net, remainingRegular);
            const overtime = Math.max(0, net - regular);

            r.Regular = round2(regular);
            r.Overtime = round2(overtime);

            weekRunning += net;
        }
    }
}

// Compute Amount AFTER Regular/Overtime are set
function computeDailyAmounts(rows) {
    for (const r of rows) {
        const rate = Math.max(0, toNum(r["Hourly Rate"]));

        // Only PAID leaves count toward Amount — LWP is excluded from pay
        const paidLeaveTotal =
            toNum(r["Sick Hrs"]) +
            toNum(r["Holiday Hrs"]) +
            toNum(r["Vacation Hrs"]) +
            toNum(r["Funeral Leave"]) +
            toNum(r["Personal Leave"]);

        const regularAmt = rate * toNum(r.Regular);
        const overtimeAmt = rate * 1.5 * toNum(r.Overtime);
        const leaveAmt = rate * paidLeaveTotal;

        r.Amount = round2(regularAmt + overtimeAmt + leaveAmt);
    }
}

/*********************************
 * PER-STAFF PER-MONTH TOTALS (payload month)
 *********************************/
function appendStaffMonthlyTotals(rows) {
    const groups = new Map(); // key: Staff|MonthToken (e.g., "2025-Aug")
    for (const r of rows) {
        const key = `${r.Staff}|${r.Month}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
    }

    const out = rows.slice(); // keep daily rows
    for (const [key, arr] of groups.entries()) {
        const [staff, monthToken] = key.split("|");

        // Representative date for totals (last day of that Month) so Month formulas match
        const repDate = monthTokenToLastDate(monthToken) || parseMDY(arr[0].Date);
        const repDateStr = toMDY(repDate);
        const yearFromToken = parseYearFromMonthToken(monthToken) ?? repDate.getFullYear();

        let sumOffice = 0,
            sumLunch = 0,
            sumNet = 0,
            sumReg = 0,
            sumOT = 0,
            sumAmt = 0;
        let sumSick = 0,
            sumHoliday = 0,
            sumVacation = 0,
            sumFuneral = 0,
            sumPersonal = 0,
            sumLWP = 0;

        for (const r of arr) {
            sumOffice += toNum(r["Hours in Office"]);
            sumLunch += toNum(r["Hours in Lunch"]);
            sumNet += toNum(r["Net Hours"]);
            sumReg += toNum(r.Regular);
            sumOT += toNum(r.Overtime);
            sumAmt += toNum(r.Amount);
            sumSick += toNum(r["Sick Hrs"]);
            sumHoliday += toNum(r["Holiday Hrs"]);
            sumVacation += toNum(r["Vacation Hrs"]);
            sumFuneral += toNum(r["Funeral Leave"]);
            sumPersonal += toNum(r["Personal Leave"]);
            sumLWP += toNum(r["Leave Without Pay"]);
        }

        const totalRow = {
            "Record ID": `Total-${staff}-${monthToken}`,
            Staff: staff,
            Date: repDateStr, // helps AppSheet formulas, if any
            Year: yearFromToken,
            Month: monthToken, // exact payload month (e.g., "2025-Aug")
            Week: 0,
            Day: 0,
            Workday: "Total",
            "Hours in Office": round2(sumOffice),
            "Hours in Lunch": round2(sumLunch),
            "Net Hours": round2(sumNet),
            Regular: round2(sumReg),
            Overtime: round2(sumOT),

            "Sick Hrs": round2(sumSick),
            "Holiday Hrs": round2(sumHoliday),
            "Vacation Hrs": round2(sumVacation),
            "Funeral Leave": round2(sumFuneral),
            "Personal Leave": round2(sumPersonal),
            "Leave Without Pay": round2(sumLWP),

            "Hourly Rate": 0, // totals: not meaningful
            Amount: round2(sumAmt), // sum of daily amounts (already excludes LWP pay)
        };

        out.push(totalRow);
    }

    logRow("INFO", "Appended totals rows", `+${out.length - rows.length}`);
    return out;
}

/*********************************
 * APPSHEET LOOKUPS & UPSERT SPLIT
 *********************************/

async function splitAddsEditsByExisting(rows) {
    if (!rows.length) return { adds: [], edits: [] };

    const ids = rows.map((r) => `"${escapeQuotes(r["Record ID"])}"`).join(",");
    const selector = `IN([Record ID], LIST(${ids}))`;
    const found = await appsheetFind(APPSHEET_TABLE, selector, ["Record ID"]);

    const existingSet = new Set(
        getRowsArray(found).map((r) =>
            String(
                r["Record ID"] ||
                r.RecordID ||
                r.Record_Id ||
                r.RecordId ||
                ""
            ).trim()
        )
    );

    const adds = [];
    const edits = [];
    rows.forEach((r) => {
        const row = mapToAppsheetRow(r);
        if (existingSet.has(r["Record ID"])) edits.push(row);
        else adds.push(row);
    });

    logRow("INFO", "Adds vs Edits", JSON.stringify({ adds: adds.length, edits: edits.length }));
    return { adds, edits };
}

/*********************************
 * APPSHEET HTTP (Node version)
 *********************************/

async function appsheetInvoke(tableName, action, rows, properties) {
    if (!APPSHEET_APP_ID || !APPSHEET_ACCESS) {
        throw new Error("AppSheet env vars NCSTAFFAPPSHEET_APP_ID / NCSTAFFAPPSHEET_ACCESS not set");
    }

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
    logRow("INFO", `API ${action} status ${resp.status}`, shorten(txt));

    try {
        return txt ? JSON.parse(txt) : { Status: resp.status, Raw: "" };
    } catch (e) {
        return { Status: resp.status, Raw: txt };
    }
}

async function appsheetFind(tableName, selectorExpr, columnNames) {
    if (!APPSHEET_APP_ID || !APPSHEET_ACCESS) {
        throw new Error("AppSheet env vars NCSTAFFAPPSHEET_APP_ID / NCSTAFFAPPSHEET_ACCESS not set");
    }

    const url = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(
        APPSHEET_APP_ID
    )}/tables/${encodeURIComponent(tableName)}/Action`;

    const body = {
        Action: "Find",
        Properties: {
            Selector: selectorExpr,
        },
    };

    if (Array.isArray(columnNames) && columnNames.length) {
        body.Properties.Columns = columnNames;
    }

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
        `API Find status ${resp.status}`,
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

/*********************************
 * FETCH EXISTING WEEK TOTALS (ROBUST)
 *********************************/

async function fetchExistingWeekTotals(staffWeekKeys) {
    const out = {};
    if (!staffWeekKeys || !staffWeekKeys.length) {
        logRow("INFO", "Existing week totals skipped (no keys)", "");
        return out;
    }

    const chunks = chunk(staffWeekKeys, 15); // keep selector manageable
    for (const ch of chunks) {
        const ors = ch.map((k) => {
            const [staff, year, week] = k.split("|");
            return `AND([Staff]="${escapeQuotes(staff)}",[Year]=${Number(
                year
            )},[Week]=${Number(week)})`;
        });
        const selector = ors.length === 1 ? ors[0] : `OR(${ors.join(",")})`;

        const findRes = await appsheetFind(APPSHEET_TABLE, selector, [
            "Staff",
            "Year",
            "Week",
            "Net Hours",
        ]);
        const rows = getRowsArray(findRes);

        rows.forEach((row) => {
            const staff = String(row["Staff"] || row.Staff || "").trim();
            const year = Number(row["Year"] || row.Year || 0);
            const week = Number(row["Week"] || row.Week || 0);
            const key = `${staff}|${year}|${week}`;
            const net = toNum(row["Net Hours"] ?? row.NetHours ?? row.Net_Hours ?? 0);
            if (!out[key]) out[key] = { totalNet: 0 };
            out[key].totalNet += net;
        });
    }

    Object.values(out).forEach((v) => (v.totalNet = round2(v.totalNet)));
    logRow("INFO", "Existing week totals fetched (safe)", shorten(out));
    return out;
}

/*********************************
 * MAPPING
 *********************************/

function mapToAppsheetRow(r) {
    return {
        "Record ID": r["Record ID"],
        Staff: r.Staff,
        Date: r.Date, // "M/D/YYYY"
        Year: r.Year,
        Month: r.Month, // e.g., "2025-Aug" (payload)
        Week: r.Week,
        Day: r.Day,
        Workday: r.Workday,
        "Hours in Office": r["Hours in Office"],
        "Hours in Lunch": r["Hours in Lunch"],
        "Net Hours": r["Net Hours"],
        Regular: r.Regular,
        Overtime: r.Overtime,

        // Leave columns
        "Sick Hrs": r["Sick Hrs"],
        "Holiday Hrs": r["Holiday Hrs"],
        "Vacation Hrs": r["Vacation Hrs"],
        "Funeral Leave": r["Funeral Leave"],
        "Personal Leave": r["Personal Leave"],
        "Leave Without Pay": r["Leave Without Pay"],

        "Hourly Rate": r["Hourly Rate"],
        Amount: r.Amount,
    };
}

/*********************************
 * UTILS
 *********************************/

function parseMDY(mdy) {
    const [m, d, y] = String(mdy)
        .split("/")
        .map((s) => Number(s));
    return new Date(y, m - 1, d);
}
function toMDY(d) {
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
function monthShortName(mIdx) {
    return (
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
        mIdx
        ] || ""
    );
}
function weekdayName(dIdx) {
    return (
        ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dIdx] ||
        ""
    );
}

// Parse "2025-Aug" or "Aug-2025" -> {year, monthIndex}
function parseMonthToken(token) {
    const t = String(token || "").trim();
    if (!t) return null;
    const monthsShort = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ];
    const monthsFull = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];

    const parts = t.split("-");
    if (parts.length !== 2) return null;

    let y = null,
        mIdx = null;

    // YYYY-MMM / YYYY-MMMM
    if (/^\d{4}$/.test(parts[0])) {
        y = Number(parts[0]);
        const mon = parts[1];
        mIdx = monthsShort.findIndex((s) => s.toLowerCase() === mon.toLowerCase());
        if (mIdx === -1)
            mIdx = monthsFull.findIndex((s) => s.toLowerCase().startsWith(mon.toLowerCase()));
        if (mIdx === -1) return null;
    }
    // MMM-YYYY / MMMM-YYYY
    else if (/^\d{4}$/.test(parts[1])) {
        y = Number(parts[1]);
        const mon = parts[0];
        mIdx = monthsShort.findIndex((s) => s.toLowerCase() === mon.toLowerCase());
        if (mIdx === -1)
            mIdx = monthsFull.findIndex((s) => s.toLowerCase().startsWith(mon.toLowerCase()));
        if (mIdx === -1) return null;
    } else {
        return null;
    }

    return { year: y, monthIndex: mIdx };
}

function parseYearFromMonthToken(token) {
    const info = parseMonthToken(token);
    return info ? info.year : null;
}
function monthTokenToLastDate(token) {
    const info = parseMonthToken(token);
    if (!info) return null;
    const { year, monthIndex } = info;
    return new Date(year, monthIndex + 1, 0); // last day of month
}

// ---- Sunday-start week helpers ----
function startOfWeekSunday(d) {
    const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = dt.getDay(); // 0=Sun
    dt.setDate(dt.getDate() - dow);
    dt.setHours(0, 0, 0, 0);
    return dt;
}
function weekNumberSunday(d) {
    const weekStart = startOfWeekSunday(d); // Sunday of this date's week
    const yearStartSunday = startOfWeekSunday(new Date(d.getFullYear(), 0, 1)); // Sunday on/before Jan 1
    const diffDays = Math.floor((weekStart - yearStartSunday) / 86400000);
    return Math.floor(diffDays / 7) + 1; // 1-based index
}

// Number parser that tolerates "$", commas, spaces, etc.
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
function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}
function escapeQuotes(s) {
    return String(s).replace(/"/g, '\\"');
}
function shorten(objOrStr, max = 750) {
    const s =
        typeof objOrStr === "string" ? objOrStr : JSON.stringify(objOrStr);
    return s.length > max ? s.slice(0, max) + "…" : s;
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

/*********************************
 * LOGGING (Node version)
 *********************************/

function logRow(level, message, details) {
    // No Google Sheet logging; just console.
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
