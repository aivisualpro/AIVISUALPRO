// scripts/practiceTracker.js

const APP_ID = process.env.GFPAPPSHEET_APP_ID;
const API_KEY = process.env.GFPAPPSHEET_API_KEY;
const TABLE_NAME = "Golf Practice Tracker";

const APPSHEET_URL = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(
  APP_ID
)}/tables/${encodeURIComponent(TABLE_NAME)}/Action`;

export default async function practiceTracker(payload) {
  if (!payload) throw new Error("No payload provided to practiceTracker");

  const calendarData = payload.calendarData || [];
  const general = (payload.generalData && payload.generalData[0]) || null;

  if (!general) throw new Error("generalData[0] is missing in payload");

  // ✅ Normalize Repeat Days into ["Mon","Tue",...]
  const selectedDays = parseSelectedDays(general.selectedDays);

  const allRows = [];

  for (const block of calendarData) {
    const dates = splitCSV(block?.dates);
    const daysRaw = splitCSV(block?.days);

    const len = Math.min(dates.length, daysRaw.length);

    for (let i = 0; i < len; i++) {
      const day = normalizeDay(daysRaw[i]); // supports "MON", "Mon", "Monday", etc.
      if (!day) continue;

      if (!selectedDays.includes(day)) continue;

      const baseRow = {
        ReferenceID: general.gfppid,
        Athlete: general.athlete,
        Day: day,
        Date: dates[i],
      };

      const dailyRaw = getRawDayData(payload, day);
      const normalized = normalizeKeys(dailyRaw, day);

      allRows.push({ ...baseRow, ...normalized });
    }
  }

  if (allRows.length === 0) {
    return {
      success: true,
      message: "No rows to add (no matching selected days).",
      inserted: 0,
    };
  }

  const requestBody = {
    Action: "Add",
    Properties: {
      Locale: "en-US",
      Timezone: "Pacific Standard Time",
      RunAsUserEmail: general.createBy,
    },
    Rows: allRows,
  };

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
    parsed = text;
  }

  if (!response.ok) {
    throw new Error(
      `AppSheet error ${response.status}: ${
        typeof parsed === "string" ? parsed : JSON.stringify(parsed)
      }`
    );
  }

  return {
    success: true,
    inserted: allRows.length,
    appsheetResponse: parsed,
  };
}

/** ---------------- Helpers ---------------- */

function splitCSV(value) {
  return (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Accepts: "MON,TUE", "Mon, Tue", "Monday,Tuesday", etc.
function parseSelectedDays(selectedDaysStr) {
  return splitCSV(selectedDaysStr)
    .map(normalizeDay)
    .filter(Boolean);
}

// Returns "Mon" | "Tue" | ... | null
function normalizeDay(token) {
  const t = String(token || "").trim();
  if (!t) return null;

  const three = t.slice(0, 3).toLowerCase();
  const map = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  };

  return map[three] || null;
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
 * Converts MonActivity/MonType/MonCategory/... → Activity / Practice Type / Practice Category / ...
 */
function normalizeKeys(data, day) {
  if (!data) return {};

  const prefix = day; // "Mon", "Tue", etc.

  const mappings = {
    [`${prefix}Activity`]: "Activity",
    [`${prefix}Type`]: "Practice Type",

    // ✅ NEW (as per your payload + table column name)
    [`${prefix}Category`]: "Practice Category",

    [`${prefix}Driver`]: "Driver (min)",
    [`${prefix}LongGame`]: "Long Game (min)",
    [`${prefix}ShortGame`]: "Short Game (min)",
    [`${prefix}Putting`]: "Putting (min)",
    [`${prefix}StrengthTraining`]: "Strength Training (min)",
    [`${prefix}MobilityTraining`]: "Mobility Training (min)",
    [`${prefix}CardioTraining`]: "Cardio Training (Min)",
    [`${prefix}StretchTraining`]: "Stretch Training (Min)",
    [`${prefix}DrillsOthers`]: "Drills Others (min)",
    [`${prefix}MentalOthers`]: "Mental Others (Min)",
    [`${prefix}StudyOthers`]: "Study Others (min)",
    [`${prefix}MiscOthers`]: "Misc Others (Min)",
    [`${prefix}Notes`]: "Notes",
  };

  const output = {};
  for (const srcKey in mappings) {
    if (Object.prototype.hasOwnProperty.call(data, srcKey)) {
      output[mappings[srcKey]] = data[srcKey];
    }
  }

  return output;
}
