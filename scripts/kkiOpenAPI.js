// scripts/kkiLithuanianNote.js
// 100% Render-safe, ESM-safe, non-throwing webhook script

const OPENAI_API_KEY = process.env.KKIOPENAPI;
const OPENAI_MODEL = "gpt-4o-mini";

function truncate(str, len = 300) {
    if (!str) return "";
    str = String(str);
    return str.length > len ? str.slice(0, len) + "…[truncated]" : str;
}

// ---------------- OpenAI Caller ----------------

async function callOpenAI(inputText, preset = "", pestType = "") {
    if (!OPENAI_API_KEY) {
        return {
            error: true,
            message: "Missing env KKIOPENAPI (OpenAI API KEY)."
        };
    }

    const systemPrompt = `
You are an editor of pest control technicians' records...

Input: ${inputText}
`.trim();

    const body = {
        model: OPENAI_MODEL,
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.3,
        max_tokens: 250,
    };

    let response;
    try {
        response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
    } catch (err) {
        return { error: true, message: "Network error calling OpenAI", details: err.message };
    }

    const raw = await response.text();

    let json;
    try {
        json = JSON.parse(raw);
    } catch (err) {
        return {
            error: true,
            message: "Invalid JSON returned by OpenAI",
            raw: truncate(raw)
        };
    }

    if (!response.ok) {
        return {
            error: true,
            message: json.error?.message || "OpenAI API returned an error",
            status: response.status,
            raw: truncate(raw)
        };
    }

    const text = json.choices?.[0]?.message?.content?.trim() || "";
    const totalTokens = json.usage?.total_tokens || null;

    return { text, totalTokens };
}

// ------------ MAIN EXPORT (REQUIRED BY server.js) ------------

export default async function kkiLithuanianNote(payload = {}) {

    console.log("[KKI] Incoming payload:", payload);

    try {
        const inputText = (payload.text || "").trim();
        const recordId = payload.recordid;

        if (!recordId && recordId !== 0) {
            return { success: false, message: `Missing field "recordid"` };
        }
        if (!inputText) {
            return { success: false, message: `Missing field "text"` };
        }

        // Call OpenAI
        const ai = await callOpenAI(inputText);

        if (ai.error) {
            console.error("[KKI] OpenAI ERROR:", ai);
            return {
                success: false,
                message: ai.message,
                details: ai.details || ai.raw || null
            };
        }

        console.log("[KKI] Output:", ai.text);

        return {
            success: true,
            message: "Processed",
            data: {
                lt: ai.text,
                tokens: ai.totalTokens,
                recordId
            }
        };

    } catch (err) {
        console.error("[KKI] Fatal:", err);
        return {
            success: false,
            message: "Internal error",
            details: err.message
        };
    }
}
