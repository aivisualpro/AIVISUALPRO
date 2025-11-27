// scripts/practiceTracker.js

// 🔐 Ideally move these to environment variables in Render
// and read them via process.env.
const APP_ID = process.env.GFPAPPSHEET_APP_IDSELF;
const API_KEY = process.env.GFPAPPSHEET_API_KEYSELF;
const TABLE_NAME = "Golf Practice Tracker";

const APPSHEET_URL = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(
    APP_ID
)}/tables/${encodeURIComponent(TABLE_NAME)}/Action`;

/**
 * Main handler function.
 * This will be called from server.js like:
 *   const result = await practiceTracker(req.body)
 */
export default async function practiceTracker(payload) {
    if (!payload) {
        throw new Error("No payload provided to practiceTracker");
    }

    const calendarData = payload.calendarData || [];
    const general = (payload.generalData && payload.generalData[0]) || null;

    if (!general) {
        throw new Error("generalData[0] is missing in payload");
    }

    // Directly convert "MON" → "Mon"
    const selectedDays = (general.selectedDays || "")
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase()); // MON → Mon

    const allRows = [];

    for (const block of calendarData) {
        const dates = (block.dates || "").split(",").map((s) => s.trim()).filter(Boolean);
        const days = (block.days || "").split(",").map((s) => s.trim()).filter(Boolean);

        for (let i = 0; i < dates.length; i++) {
            const day = days[i];

            if (!selectedDays.includes(day)) continue;

            const baseRow = {
                GFPPID: general.gfppid,
                Athlete: general.athlete,
                Category: "Coach",
                Date: dates[i],
            };

            const dailyRaw = getRawDayData(payload, day);
            const normalized = normalizeKeys(dailyRaw, day);

            allRows.push({ ...baseRow, ...normalized });
        }
    }

    if (allRows.length === 0) {
        // Nothing to send; return a nice response
        return {
            success: true,
            message: "No rows to add (no matching selected days).",
            inserted: 0,
        };
    }

    // Build AppSheet request body
    const requestBody = {
        Action: "Add",
        Properties: {
            Locale: "en-US",
            Timezone: "Pacific Standard Time",
            RunAsUserEmail: general.createBy,
        },
        Rows: allRows,
    };

    // Node 18+ has global fetch available.
    // If you're on older Node, install node-fetch and import it.
    const response = await fetch(APPSHEET_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ApplicationAccessKey: API_KEY,
        },
        body: JSON.stringify(requestBody),
    });

    const text = await response.text();
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        parsed = text; // sometimes AppSheet returns empty body
    }

    if (!response.ok) {
        throw new Error(
            `AppSheet error ${response.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`
        );
    }

    return {
        success: true,
        inserted: allRows.length,
        appsheetResponse: parsed,
    };
}

/**
 * Returns the raw day-specific data block (Mon/Tue/…)
 */
function getRawDayData(payload, day) {
    const map = {
        Mon: payload.mondayData?.[0],
        Tue: payload.tuesdayData?.[0],
        Wed: payload.wednesdayData?.[0],
        Thu: payload.thursdayData?.[0],
        Fri: payload.fridayData?.[0],
        Sat: payload.saturdayData?.[0],
        Sun: payload.sundayData?.[0],
    };

    return map[day] || {};
}

/**
 * Converts MonActivity/MonType/... → Activity / Practice Type / ...
 */
function normalizeKeys(data, day) {
    if (!data) return {};

    const prefix = day.slice(0, 3); // "Mon", "Tue", etc.
    const mappings = {
        [`${prefix}Activity`]: "Activity",
        [`${prefix}Type`]: "Practice Type",
        [`${prefix}Driver`]: "Driver (min)",
        [`${prefix}LongGame`]: "Long Game (min)",
        [`${prefix}ShortGame`]: "Short Game (min)",
        [`${prefix}Putting`]: "Putting (min)",
        [`${prefix}StrengthTraining`]: "Strength Training (min)",
        [`${prefix}MobilityTraining`]: "Mobility Training (min)",
        [`${prefix}CardioTraining`]: "Cardio Training (Min)",
        [`${prefix}Notes`]: "Notes",
    };

    const output = {};
    for (const key in mappings) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            output[mappings[key]] = data[key];
        }
    }

    return output;
}
