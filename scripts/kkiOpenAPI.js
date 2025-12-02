// scripts/kkiLithuanianNote.js
// Node version of your Apps Script doPost

const OPENAI_API_KEY = process.env.KKIOPENAPI;
const OPENAI_MODEL = "gpt-4o-mini";

// AppSheet (not used yet in this trimmed version, but wired for later)
const APPSHEET_APP_ID = process.env.KKIAPPSHEET_APP_ID;
const APPSHEET_ACCESS = process.env.KKIAPPSHEET_ACCESS;
const APPSHEET_TABLE = "Question form";
const COL_TEXT = "Pastabos pasiulymai AUTO";
const COL_TOKENS = "Pastabos pasiulymai AUTO Tokens";
const DEFAULT_KEY_COLUMN = "Form ID";

// ---- Helpers ----

function makeError(stage, message, httpCode, extra) {
    const err = new Error(message);
    err.stage = stage || "Error";
    err.httpCode = httpCode || 500;
    if (extra) err.extra = extra;
    return err;
}

function truncate(str, maxLen) {
    if (!str) return "";
    str = String(str);
    return str.length > maxLen ? str.slice(0, maxLen) + "…[truncated]" : str;
}

/**
 * Call OpenAI to generate Lithuanian note
 */
async function generateLithuanianNote(inputText, preset = "", pestType = "") {
    if (!OPENAI_API_KEY) {
        throw makeError(
            "Config",
            "Missing OPENAI API key (env KKIOPENAPI).",
            500
        );
    }

    const systemPrompt = `
You are an editor of pest control technicians' records. Your task is to rewrite a short technician note into a professional, clear, and concise entry that fits a PDF inspection report.

Rules:
1. Do not change or remove addresses, numbers, codes, or labels (e.g., "Pietinė g. 9", "3 namo rūsiuose", "(V25-0359430-10)"). These must be exactly as they are.
2. Correct all spelling, grammar, and punctuation mistakes in the text.
3. Describe what work was performed in detail (e.g., what was checked, added, removed, or inspected). Use clear action verbs like "patikrinta", "papildyta", "pašalinta", "pastatyta", "apžiūrėta", etc.
4. After describing the work, add comprehensive recommendations for the site. These should focus on:
   - Sealing any openings or gaps.
   - Maintaining cleanliness (keeping areas clean, removing food waste, and preventing clutter).
   - Food waste storage (keep food waste in closed containers, clean regularly).
   - Monitoring for pests (regular checks, watching for new activity).
5. Recommendations should be actionable and professional, providing clear instructions for the property owner.
6. Ensure the text fits into two short sentences and is professional and concise. No bullet points, lists, or headings.
7. Preserve all addresses, numbers, and labels exactly as they are.

Input: ${inputText}
`.trim();

    const body = {
        model: OPENAI_MODEL,
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.3,
        max_tokens: 250,
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    const text = await res.text();
    let json;

    try {
        json = JSON.parse(text);
    } catch (e) {
        throw makeError(
            "OpenAI",
            "Failed to parse OpenAI response.",
            500,
            truncate(text, 500)
        );
    }

    if (!res.ok) {
        const msg =
            json.error?.message ||
            `OpenAI API error (status ${res.status})`;
        throw makeError("OpenAI", msg, res.status, json);
    }

    const ltText = json.choices?.[0]?.message?.content?.trim() || "";
    const usage = json.usage || {};
    const totalTokens = usage.total_tokens || null;

    return { ltText, totalTokens };
}

// ---- Main handler (called by server.js via /webhook/kkiLithuanianNote) ----

export default async function kkiLithuanianNote(payload = {}) {
    try {
        console.log("[KKI] incoming payload:", JSON.stringify(payload));

        // In the Apps Script you had flexible parsing; here we assume JSON body already
        const inputText = (payload.text || "").toString().trim();
        const recordId =
            payload.recordid !== undefined ? payload.recordid : "";
        const keyColumn = payload.keyColumn || DEFAULT_KEY_COLUMN;
        const preset = payload.preset || "";
        const templates =
            typeof payload.templates === "boolean" ? payload.templates : true;
        const pestType = payload.pestType || payload.pestTypes || "";

        if (!recordId && recordId !== 0) {
            throw makeError("BadRequest", 'Field "recordid" is required.', 400);
        }
        if (!inputText) {
            throw makeError("BadRequest", 'Field "text" is required.', 400);
        }

        // Call OpenAI
        const { ltText, totalTokens } = await generateLithuanianNote(
            inputText,
            preset,
            pestType
        );

        console.log("[KKI] Generated Text:", ltText);

        // TODO (OPTIONAL): here you can call AppSheet API to update the row
        // using APPSHEET_APP_ID / APPSHEET_ACCESS / APPSHEET_TABLE / COL_TEXT / COL_TOKENS

        return {
            success: true,
            message: "Processed (OpenAI only, no AppSheet update yet).",
            data: {
                lt: ltText,
                tokens: totalTokens,
                recordId,
                keyColumn,
            },
        };
    } catch (err) {
        console.error("[KKI] Error:", err);

        return {
            success: false,
            message: err.message || "Unknown error",
            stage: err.stage || "Error",
            httpCode: err.httpCode || 500,
            extra: err.extra ? truncate(JSON.stringify(err.extra), 500) : undefined,
        };
    }
}
