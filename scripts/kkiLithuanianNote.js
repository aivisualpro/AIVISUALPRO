// scripts/kkiLithuanianNote.js
// Node/ESM conversion of your Apps Script: OpenAI + AppSheet update

const OPENAI_API_KEY = process.env.KKIOPENAPI;
const OPENAI_MODEL = "gpt-4o-mini";

const APPSHEET_APP_ID = process.env.KKIAPPSHEET_APP_ID;
const APPSHEET_ACCESS = process.env.KKIAPPSHEET_ACCESS;
const APPSHEET_TABLE = "Question form";

const COL_TEXT = "Pastabos pasiulymai AUTO";
const COL_TOKENS = "Pastabos pasiulymai AUTO Tokens";
const DEFAULT_KEY_COLUMN = "Form ID";

// Small helper
function truncate(str, max = 4000) {
    if (!str) return "";
    str = String(str);
    return str.length > max ? str.slice(0, max - 3) + "..." : str;
}

// ========== MAIN EXPORT (CALLED BY server.js) ==========

export default async function kkiLithuanianNote(payload = {}) {
    console.log("[KKI] Incoming payload:", payload);

    let inputText = "";
    let recordId = "";
    let keyColumn = DEFAULT_KEY_COLUMN;
    let preset = "";
    let templates = true;
    let pestType = "";
    let keyAsNumber = false;

    try {
        // 1) Extract fields from JSON body AppSheet sends
        inputText = (payload.text ?? "").toString().trim();
        recordId = payload.recordid ?? "";
        keyColumn = payload.keyColumn ? String(payload.keyColumn) : DEFAULT_KEY_COLUMN;
        preset = payload.preset ? String(payload.preset) : "";
        templates = typeof payload.templates === "boolean" ? payload.templates : true;
        pestType = payload.pestType || payload.pestTypes || "";

        // guess numeric key if recordid is all digits
        keyAsNumber = typeof payload.keyAsNumber === "boolean"
            ? payload.keyAsNumber
            : /^\d+$/.test(String(recordId));

        // 2) Validate
        if (!recordId && recordId !== 0) {
            return { success: false, message: 'Field "recordid" is required.' };
        }
        if (!inputText) {
            return { success: false, message: 'Field "text" is required.' };
        }

        if (!OPENAI_API_KEY) {
            return { success: false, message: "Missing env KKIOPENAPI (OpenAI API key)." };
        }
        if (!APPSHEET_APP_ID || !APPSHEET_ACCESS) {
            return { success: false, message: "Missing AppSheet envs KKIAPPSHEET_APP_ID / KKIAPPSHEET_ACCESS." };
        }

        const keyValue = keyAsNumber ? Number(recordId) : String(recordId);

        // 3) Check existing row to avoid loop
        const existingRow = await getAppSheetRow({
            keyColumn,
            keyValue
        });

        if (existingRow && existingRow[COL_TEXT] && String(existingRow[COL_TEXT]).trim() !== "") {
            const finalAlreadyThere = String(existingRow[COL_TEXT]).trim();
            console.log("[KKI] Row already had AI text. Skipping.");
            return {
                success: true,
                skipped: true,
                message: "Row already had AI text. Skipped regeneration to avoid loop.",
                data: {
                    lt: finalAlreadyThere,
                    tokens: null,
                    appsheet: { skipped: true, reason: "AlreadyHadText" }
                }
            };
        }

        // 4) Call OpenAI to generate Lithuanian note
        const { ltText, totalTokens } = await generateLithuanianNote(inputText, preset, pestType);

        // 5) Apply templates and cleaning logic
        const draftedWithTemplates = templates
            ? applyTemplates(inputText, ltText, pestType)
            : String(ltText || "").trim();

        const cleanedClaims = sanitizeActivityClaims(inputText, draftedWithTemplates);
        const withNoActivity = ensureNoActivitySentence(inputText, cleanedClaims);
        const withId = injectIdentifier(inputText, withNoActivity);
        const finalLT = injectNumbers(inputText, withId);

        // 6) Update AppSheet row (Action: "Edit")
        const appSheetResp = await updateAppSheetRow({
            keyColumn,
            keyValue,
            text: finalLT,
            tokens: totalTokens
        });

        console.log("[KKI] Final text:", finalLT);

        return {
            success: true,
            skipped: false,
            message: "Processed and updated in AppSheet.",
            data: {
                lt: finalLT,
                tokens: totalTokens,
                appsheet: appSheetResp
            }
        };

    } catch (err) {
        console.error("[KKI] ERROR:", err);
        return {
            success: false,
            message: err?.message || "Internal error",
            details: truncate(String(err?.stack || err), 1000)
        };
    }
}

// ========== OpenAI Part (Node fetch) ==========

async function generateLithuanianNote(inputText, preset, pestType) {
    const pestInfo = pestType
        ? ` Pagrindinis kenkėjas: "${pestType}". Naudok terminiją ir rekomendacijas, kurios labiausiai tinka šiam kenkėjui.`
        : "";

    const systemPrompt =
        "Tu esi kenkėjų kontrolės technikas. " +
        "Tau pateikiama neformali techniko pastaba (anglų, lietuvių arba mišri kalba). " +
        "Tavo užduotis – perrašyti ją į glaustą, formalią LIETUVIŠKĄ ataskaitos ištrauką klientui.\n\n" +
        "TAISYKLĖS:\n" +
        "1. Jei technikas AIŠKIAI nurodo faktinį radinį ar aktyvumo įrodymus (pvz. \"rastos išmatos\", \"matėme graužiką\", \"pastebėtas aktyvumas\"), tu gali tai įvardinti.\n" +
        "2. JEI TO NĖRA, nerašyk ir neužsimink apie pastebėtą aktyvumą, įrodymus ar patvirtinimą. " +
        "   Nevartok frazių kaip \"Stebėtas graužikų aktyvumas\", \"patvirtintas aktyvumas\", \"nustatyta veikla\".\n" +
        "3. Jei pastaboje minima, kad kenkėjų nepastebėta / no pests observed, tu turi aiškiai parašyti \"Kenkėjų nepastebėta\" ir tuomet pateikti rekomendaciją tęsti stebėseną.\n" +
        "4. VISADA įtrauk aiškią VEIKSMO rekomendaciją arba kas buvo padaryta/palikta: " +
        "   pvz. \"Rekomenduojama tęsti graužikų stebėseną\", \"Palikti 2 lipdukai\", \"Pakeisti jaukus\".\n" +
        "5. Palik visus identifikatorius ir kodus tiksliai kaip tekste (pvz. \"V77777.\"). " +
        "   Neišmesk ir nekeisk jų.\n" +
        "6. Neišmesk ir nekeisk JOKIŲ skaitinių reikšmių, kiekių, procentų, plotų ar mato vienetų " +
        "   (pvz. \"800m2\", \"22\", \"5 vnt\", \"3%\"). Palik skaičius IDENTIŠKUS.\n" +
        "7. Stilius: trumpas, techninis, be \"Pastaba:\", be kabučių. 1–3 sakiniai.\n" +
        pestInfo;

    const examples = [
        {
            role: "user",
            content: "V56789. Rodent monitoring recommended. Two stickers left."
        },
        {
            role: "assistant",
            content: "V56789. Rekomenduojama vykdyti graužikų stebėseną. Palikti 2 lipdukai."
        },
        {
            role: "user",
            content: "Ceiling area: droppings seen, rodents confirmed in attic. Two snap traps placed."
        },
        {
            role: "assistant",
            content:
                "Lubų zonoje nustatyti graužikų pėdsakai (rastos išmatos). " +
                "Išdėtos dvi spąstai; rekomenduojama užsandarinti galimus patekimo taškus."
        },
        {
            role: "user",
            content: "Bin area: fly monitoring recommended, install more traps."
        },
        {
            role: "assistant",
            content:
                "Prie konteinerio rekomenduojama vykdyti musių stebėseną ir įrengti papildomas gaudykles."
        },
        {
            role: "user",
            content: "A lot of flies near garbage bin, visible activity. Add more traps."
        },
        {
            role: "assistant",
            content:
                "Prie šiukšlių konteinerio pastebėtas padidėjęs musių aktyvumas. " +
                "Rekomenduojama įrengti papildomas gaudykles ir peržiūrėti atliekų tvarkymo praktiką."
        },
        {
            role: "user",
            content: "V77777. No pests observed. Two stickers placed."
        },
        {
            role: "assistant",
            content:
                "V77777. Kenkėjų nepastebėta. Rekomenduojama tęsti stebėseną. Palikti 2 lipdukai."
        }
    ];

    const userPrompt =
        "Techniko pastaba (gali būti EN/LT mix):\n" +
        inputText +
        "\n\n" +
        "Pagal taisykles aukščiau pateik galutinį profesionalų tekstą lietuvių kalba (1–3 sakiniai). " +
        "Jei tekste minima, kad kenkėjų nepastebėta, tai turi būti aiškiai parašyta ir pridėta rekomendacija tęsti stebėseną. " +
        "Jei tekste yra tik rekomendacija stebėti, nerašyk, kad aktyvumas buvo matomas. " +
        "Palik visus kodus (pvz. V77777.) ir visus skaičius (pvz. 22) nepakitusius. " +
        "Grąžink tik galutinį tekstą be kabučių.";

    const messages = [{ role: "system", content: systemPrompt }]
        .concat(examples)
        .concat([{ role: "user", content: userPrompt }]);

    let resp;
    try {
        resp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                temperature: 0.2,
                presence_penalty: 0.0,
                frequency_penalty: 0.0,
                messages
            })
        });
    } catch (err) {
        throw new Error("Failed to reach OpenAI: " + err.message);
    }

    const raw = await resp.text();
    if (!resp.ok) {
        throw new Error("OpenAI HTTP " + resp.status + ": " + truncate(raw, 500));
    }

    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        throw new Error("Invalid JSON from OpenAI: " + truncate(raw, 500));
    }

    const ltText =
        (data.choices &&
            data.choices[0] &&
            data.choices[0].message &&
            data.choices[0].message.content) ||
        "";
    const totalTokens =
        (data.usage && (data.usage.total_tokens || data.usage.totalTokens)) || null;

    if (!ltText.trim()) {
        throw new Error("OpenAI returned empty content.");
    }

    return { ltText: ltText.trim(), totalTokens };
}

// ========== AppSheet: Find & Edit ==========

async function getAppSheetRow({ keyColumn, keyValue }) {
    const endpoint = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(
        APPSHEET_APP_ID
    )}/tables/${encodeURIComponent(APPSHEET_TABLE)}/Action`;

    const body = {
        Action: "Find",
        Properties: { Locale: "lt-LT", Timezone: "Europe/Vilnius" },
        Rows: [{ [keyColumn]: keyValue }]
    };

    let resp;
    try {
        resp = await fetch(endpoint, {
            method: "POST",
            headers: {
                ApplicationAccessKey: APPSHEET_ACCESS,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
    } catch (err) {
        console.error("[KKI] AppSheet Find fetch error:", err);
        return null;
    }

    const raw = await resp.text();
    if (!resp.ok) {
        console.error("[KKI] AppSheet Find HTTP error:", resp.status, raw);
        return null;
    }

    let json;
    try {
        json = JSON.parse(raw);
    } catch (err) {
        console.error("[KKI] AppSheet Find parse error:", err, raw);
        return null;
    }

    if (Array.isArray(json) && json.length > 0) {
        return json[0];
    }
    return null;
}

async function updateAppSheetRow({ keyColumn, keyValue, text, tokens }) {
    const endpoint = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(
        APPSHEET_APP_ID
    )}/tables/${encodeURIComponent(APPSHEET_TABLE)}/Action`;

    const rowObj = {};
    rowObj[keyColumn] = keyValue;
    rowObj[COL_TEXT] = text;
    rowObj[COL_TOKENS] = tokens != null ? Number(tokens) : null;

    const body = {
        Action: "Edit",
        Properties: { Locale: "lt-LT", Timezone: "Europe/Vilnius" },
        Rows: [rowObj]
    };

    let resp;
    try {
        resp = await fetch(endpoint, {
            method: "POST",
            headers: {
                ApplicationAccessKey: APPSHEET_ACCESS,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
    } catch (err) {
        throw new Error("Failed to reach AppSheet: " + err.message);
    }

    const raw = await resp.text();
    if (!resp.ok) {
        throw new Error("AppSheet HTTP " + resp.status + ": " + truncate(raw, 500));
    }

    let json;
    try {
        json = JSON.parse(raw);
    } catch {
        throw new Error("Could not parse AppSheet response: " + truncate(raw, 500));
    }

    if (Array.isArray(json) && json.length > 0 && json[0].Errors) {
        throw new Error("AppSheet row update failed: " + json[0].Errors);
    }

    return json;
}

// ========== Text Post-Processing Helpers ==========

function sanitizeActivityClaims(originalInput, generatedLT) {
    const src = (originalInput || "").toLowerCase();
    const evidenceRegex =
        /(dropp|feces|faeces|išmat|ismat|išmatu|mačiau|maciau|saw|seen|observ|caught|rasta|rastos|confirmed|patvirt|aktyvumas pasteb|pastebėtas aktyvumas|pastebetas aktyvumas)/i;
    const hasEvidence = evidenceRegex.test(src);

    if (hasEvidence) return generatedLT;

    const text = String(generatedLT || "");
    const rawSentences = text
        .split(/(?<=[\.\?\!])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    const cleaned = [];

    for (const sent of rawSentences) {
        const lower = sent.toLowerCase();
        const looksLikeActivityClaim =
            /aktyvum/.test(lower) ||
            /steb[eė]t/.test(lower) ||
            /pasteb[eė]t/.test(lower) ||
            /patvirt/.test(lower) ||
            /nustaty/.test(lower);

        if (looksLikeActivityClaim && !hasEvidence) {
            if (/graužik/.test(lower) || /grauzik/.test(lower)) {
                cleaned.push("Rekomenduojama vykdyti graužikų stebėseną.");
                continue;
            }
            if (/musių|musiu|muse|musių/.test(lower) || /muse/.test(lower)) {
                cleaned.push("Rekomenduojama vykdyti musių stebėseną.");
                continue;
            }
            continue;
        }

        cleaned.push(sent);
    }

    if (cleaned.length === 0) return generatedLT;
    return cleaned.join(" ").trim();
}

function ensureNoActivitySentence(originalInput, draftedText) {
    const src = String(originalInput || "").toLowerCase();
    const noActivityRegex =
        /(nepasteb[eė]ta|nepastebeta|no\s+(pest|pests|activity|evidence|signs)|nenustatyta|no\s+rodent\s+activity|no\s+insects|no\s+flies)/i;
    const hasNoActivity = noActivityRegex.test(src);

    if (!hasNoActivity) return draftedText.trim();

    let finalText = String(draftedText || "").trim();

    if (!/nepasteb[eė]ta/i.test(finalText) && !/kenk[eė]j[uų] nepasteb[eė]ta/i.test(finalText)) {
        finalText = "Kenkėjų nepastebėta. " + finalText;
    }

    if (!/steb[eė]sen|t[eė]sti steb[eė]sen|t[eė]sti\s+stebejim/i.test(finalText)) {
        finalText = finalText + " Rekomenduojama tęsti stebėseną.";
    }

    return finalText.trim();
}

function applyTemplates(enInput, ltGenerated, pestType) {
    const s = (String(enInput || "") + " " + String(pestType || "")).toLowerCase();

    const has = {
        flies:
            /\b(fly|flies)\b/.test(s) ||
            /\bmuse(s)?\b/i.test(s) ||
            /\bmus[eė]s?\b/i.test(s),
        garbage:
            /\b(garbage|trash|bin|container|dumpster|trashcan)\b/.test(s) ||
            /\bšiukš/i.test(s),
        rodents:
            /\b(rodent|rodents|mouse|mice|rat|rats)\b/.test(s) ||
            /\bgraužik/i.test(s),
        ceiling:
            /\b(ceiling|attic|loft)\b/.test(s) ||
            /\blub|palub|palėp/i.test(s),
        droppings:
            /\b(dropping|droppings|feces|faeces|poo|stool)\b/.test(s) ||
            /\bišmat/i.test(s)
    };

    if (has.flies && has.garbage) {
        return (
            "Rekomenduojama vykdyti musių stebėseną prie šiukšlių konteinerio, " +
            "įrengti papildomas musių gaudykles ir peržiūrėti atliekų tvarkymo praktiką."
        );
    }

    if (has.rodents && has.ceiling && has.droppings) {
        return (
            "Lubų zonoje nustatyti graužikų pėdsakai (rastos išmatos). " +
            "Rekomenduojama išdėstyti spąstus ir užsandarinti galimus patekimo taškus."
        );
    }

    if (has.rodents && has.ceiling) {
        return (
            "Gauta informacija apie galimą graužikų veiklą lubų zonoje. " +
            "Rekomenduojama išdėstyti spąstus ir įvertinti galimus patekimo taškus jų sandarinimui."
        );
    }

    if (has.rodents) {
        return (
            "Rekomenduojama vykdyti graužikų stebėseną, išdėstyti spąstus ir užsandarinti galimus patekimo taškus."
        );
    }

    if (has.flies) {
        return (
            "Rekomenduojama vykdyti musių stebėseną, įrengti papildomas gaudykles ir įvertinti švaros bei atliekų tvarkymo praktiką."
        );
    }

    return String(ltGenerated || "").trim();
}

function injectIdentifier(src, out) {
    const source = String(src || "");
    let finalText = String(out || "");

    const m = /^\s*(\S+)/.exec(source);
    if (!m) return finalText.trim();

    const idToken = m[1];
    if (idToken && finalText.indexOf(idToken) === -1) {
        finalText = idToken + " " + finalText;
    }

    return finalText.trim();
}

function injectNumbers(src, out) {
    const sourceText = String(src || "");
    let finalText = String(out || "");

    const numericTokens = [];
    const reCombined = /(\d+(?:[\.,]\d+)?[^\s,;:]*)/g;
    let m;
    while ((m = reCombined.exec(sourceText)) !== null) {
        const tok = m[1];
        if (tok && !numericTokens.includes(tok)) {
            numericTokens.push(tok);
        }
    }

    numericTokens.forEach((tok) => {
        if (tok && finalText.indexOf(tok) === -1) {
            finalText += " " + tok;
        }
    });

    return finalText.trim();
}
