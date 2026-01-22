// scripts/kkiLithuanianNote.groq.js
// Node/ESM: Groq (OpenAI-compatible) + AppSheet update for Lithuanian pest-control notes
//
// ENV:
//   GROQ_API_KEY
//   GROQ_MODEL (optional) default: "openai/gpt-oss-20b"
//   KKIAPPSHEET_APP_ID
//   KKIAPPSHEET_ACCESS
//
// Payload example you send:
// {
//   "text": "...",
//   "recordid": "10101",
//   "pestTypes": "Peles",
//   "Speciality": "Andrius Čepas"
// }
//
// NOTE: Make sure DEFAULT_KEY_COLUMN matches the key column in your AppSheet table.
// If your key column is truly "Form ID", keep it.
// If your key column is "recordid", set DEFAULT_KEY_COLUMN = "recordid".

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const APPSHEET_APP_ID = process.env.KKIAPPSHEET_APP_ID;
const APPSHEET_ACCESS = process.env.KKIAPPSHEET_ACCESS;
const APPSHEET_TABLE = "Question form";

const COL_TEXT = "Pastabos pasiulymai AUTO";
const COL_TOKENS = "Pastabos pasiulymai AUTO Tokens";
const COL_SPECIALIST = "Specialisto vardas";

// ✅ IMPORTANT: Set this to your table key column name
const DEFAULT_KEY_COLUMN = "Form ID";

// Default if specialist is missing
const DEFAULT_SPECIALIST = "Andrius Čepas";

function truncate(str, max = 4000) {
  if (!str) return "";
  str = String(str);
  return str.length > max ? str.slice(0, max - 3) + "..." : str;
}

/* ============================================================
 * Pest-type label mapping (based on your style)
 * ============================================================ */
const PEST_LABEL_PREFIX = {
  Ziurkes: "Atlikta griaužikų (žiurkių) deratizacija",
  Peles: "Atlikta pelių kontrolė",
  Tarakonai: "Atliktas tarakonų naikinimas",
  Blusos: "Atliktas blusų naikinimas",
  Pauksciai: "Atliktas paukščių atbaidymas",
  Skruzdeles: "Atliktas skruzdėlių naikinimas",
  "Skruzdels, tarakonai": "Atliktas skruzdėlių ir tarakonų naikinimas",
  Kates: "Atlikta kačių situacijos fiksacija",
};

function getPestLabelPrefix(pestTypeRaw) {
  if (!pestTypeRaw) return "";
  const v = String(pestTypeRaw).trim();
  return PEST_LABEL_PREFIX[v] || "";
}

/** Accept your payload field name variations */
function pickSpecialistName(payload = {}, existingRow = null) {
  return (
    (existingRow && existingRow[COL_SPECIALIST]) ||
    payload.Speciality || // ✅ your payload
    payload.Specialisto ||
    payload.specialist ||
    payload.specialisto ||
    payload.specialistName ||
    DEFAULT_SPECIALIST
  );
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
    recordId = payload.recordid ?? payload.recordId ?? payload.id ?? "";
    keyColumn = payload.keyColumn ? String(payload.keyColumn) : DEFAULT_KEY_COLUMN;
    preset = payload.preset ? String(payload.preset) : "";
    templates = typeof payload.templates === "boolean" ? payload.templates : true;
    pestType = payload.pestType || payload.pestTypes || payload.pestTypes || "";

    // guess numeric key if recordid is all digits
    keyAsNumber =
      typeof payload.keyAsNumber === "boolean"
        ? payload.keyAsNumber
        : /^\d+$/.test(String(recordId));

    // 2) Validate
    if (recordId === "" || recordId === null || recordId === undefined) {
      return { success: false, message: 'Field "recordid" is required.' };
    }
    if (!inputText) {
      return { success: false, message: 'Field "text" is required.' };
    }
    if (!GROQ_API_KEY) {
      return { success: false, message: "Missing env GROQ_API_KEY (Groq API key)." };
    }
    if (!APPSHEET_APP_ID || !APPSHEET_ACCESS) {
      return {
        success: false,
        message: "Missing AppSheet envs KKIAPPSHEET_APP_ID / KKIAPPSHEET_ACCESS.",
      };
    }

    const keyValue = keyAsNumber ? Number(recordId) : String(recordId);

    // 3) Check existing row to avoid loop
    const existingRow = await getAppSheetRow({ keyColumn, keyValue });

    const specialistName = pickSpecialistName(payload, existingRow);

    // skip regen if already has AI text
    if (existingRow && existingRow[COL_TEXT] && String(existingRow[COL_TEXT]).trim() !== "") {
      const finalAlreadyThere = String(existingRow[COL_TEXT]).trim();
      console.log("[KKI] Row already had AI text. Skipping.");
      return {
        success: true,
        skipped: true,
        message: "Row already had AI text. Skipped regeneration to avoid loop.",
        data: {
          [COL_TEXT]: finalAlreadyThere,
          [COL_SPECIALIST]: existingRow?.[COL_SPECIALIST] ?? specialistName,
          [COL_TOKENS]: existingRow?.[COL_TOKENS] ?? null,
          lt: finalAlreadyThere,
          tokens: existingRow?.[COL_TOKENS] ?? null,
          appsheet: { skipped: true, reason: "AlreadyHadText" },
        },
      };
    }

    // 4) Call Groq to generate Lithuanian note
    const { ltText, totalTokens } = await generateLithuanianNote(inputText, preset, pestType);

    // 5) Apply templates + cleaning logic
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
      tokens: totalTokens,
      specialist: specialistName,
    });

    console.log("[KKI] Final text:", finalLT);

    return {
      success: true,
      skipped: false,
      message: "Processed and updated in AppSheet.",
      data: {
        [COL_TEXT]: finalLT,
        [COL_SPECIALIST]: specialistName,
        [COL_TOKENS]: totalTokens,
        lt: finalLT,
        tokens: totalTokens,
        appsheet: appSheetResp,
      },
    };
  } catch (err) {
    console.error("[KKI] ERROR:", err);
    return {
      success: false,
      message: err?.message || "Internal error",
      details: truncate(String(err?.stack || err), 1000),
    };
  }
}

// ========== Groq Part (OpenAI-compatible Chat Completions) ==========

async function generateLithuanianNote(inputText, preset, pestType) {
  const pestLabel = getPestLabelPrefix(pestType);

  const pestInfo = pestType
    ? `\nPagrindinis kenkėjų tipas (iš AppSheet laukelio "pestTypes"): "${pestType}".`
    : "";

  const styleHint = pestLabel
    ? `\nJei įmanoma, pirmoje sakinio dalyje natūraliai panaudok frazę "${pestLabel}" ir tęsk aprašant atliktus darbus bei rekomendacijas.`
    : "";

  const systemPrompt =
    "You are an editor of pest control technicians’ records. " +
    "Your task is to rewrite a short technician note so that it is suitable for a short entry in a PDF inspection report form.\n\n" +
    "BENDROS TAISYKLĖS (VISKAS LIETUVIŲ KALBA):\n" +
    "1. Nekeisk ir nešalink adresų, numerių, kodų ar žymų.\n" +
    "2. NEKURK naujų adresų, numerių, kodų, datų ar žymų – naudok tik tai, kas yra techniko tekste.\n" +
    "3. Tekstą rašyk lietuviškai ir ištaisyk rašybos, gramatikos bei skyrybos klaidas.\n" +
    "4. NEKURK naujų paslaugų ar veiksmų, kurie nėra užsiminti pastaboje.\n" +
    "5. Visada pridėk trumpas rekomendacijas pagal kenkėjų tipą (ar neutralias, jei neaišku).\n" +
    "6. MAKSIMALIAI 2 trumpi sakiniai, apie 30–40 žodžių, vienas paragrafas, be sąrašų.\n" +
    "7. Nenaudok „Rekomenduojama:“ kaip antraštės.\n" +
    "8. Jei nėra įrodymų, nerašyk, kad aktyvumas pastebėtas/patvirtintas.\n" +
    "9. Jei aiškiai parašyta, kad kenkėjų nepastebėta, turi būti sakinys apie tai + stebėsena.\n" +
    "10. Skaičių/kodų nekeisk.\n\n" +
    "REKOMENDACIJŲ ŠABLONAI PAGAL KENKĖJŲ TIPĄ:\n" +
    "- Žiurkės/pelės: sandarinimas, švara, nelaikyti maisto atliekų, sandarūs indai.\n" +
    "- Tarakonai: švara, nelikti maisto/indų per naktį, drėgmės šaltiniai, sandarinimas.\n" +
    "- Skruzdėlės: saldūs produktai, švara, plyšių sandarinimas.\n" +
    "- Blusos: tekstilės skalbimas, augintinių gydymas.\n" +
    "- Paukščiai: nelesinti, konteineriai uždaryti, valymas.\n" +
    "- Katės: nelesinti, durys/konteineriai uždaryti, savivaldybė/gyvūnų kontrolė.\n" +
    "- Mišrūs: bendra švara, maisto laikymas, sandarinimas.\n\n" +
    "TEKSTO STRUKTŪRA:\n" +
    "- 1 sakinys apie atliktus darbus.\n" +
    "- 1 sakinys su rekomendacijomis.\n" +
    pestInfo +
    styleHint;

  const examples = [
    {
      role: "user",
      content:
        "Peles. peliu kontrole rusiai ir techn patalpos, papildem masalu stoteles ir pastatem nauju kur vaiksto, be kitu darbu",
    },
    {
      role: "assistant",
      content:
        "Atlikta pelių kontrolė rūsiuose ir techninėse patalpose: papildytos masalo stotelės ir pastatytos naujos judėjimo vietose; rekomenduojama sandariai laikyti maistą, nepalikti trupinių ir atliekų bei užsandarinti plyšius.",
    },
  ];

  const userPrompt =
    "Techniko pastaba (gali būti EN/LT mix):\n" +
    inputText +
    "\n\n" +
    "Perrašyk pagal taisykles: 1–2 trumpi sakiniai (30–40 žodžių), vienas paragrafas, be sąrašų.\n" +
    "Palik visus kodus ir skaičius nepakitusius. Grąžink TIK galutinį lietuvišką tekstą.";

  const messages = [{ role: "system", content: systemPrompt }, ...examples, { role: "user", content: userPrompt }];

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      messages,
    }),
  });

  const raw = await resp.text();
  if (!resp.ok) throw new Error("Groq HTTP " + resp.status + ": " + truncate(raw, 500));

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON from Groq: " + truncate(raw, 500));
  }

  const ltText = data?.choices?.[0]?.message?.content || "";
  const totalTokens = data?.usage?.total_tokens ?? null;

  if (!String(ltText).trim()) throw new Error("Groq returned empty content.");

  return { ltText: String(ltText).trim(), totalTokens };
}

// ========== AppSheet: Find & Edit ==========

async function getAppSheetRow({ keyColumn, keyValue }) {
  const endpoint = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(
    APPSHEET_APP_ID,
  )}/tables/${encodeURIComponent(APPSHEET_TABLE)}/Action`;

  const body = {
    Action: "Find",
    Properties: { Locale: "lt-LT", Timezone: "Europe/Vilnius" },
    Rows: [{ [keyColumn]: keyValue }],
  };

  let resp;
  try {
    resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        ApplicationAccessKey: APPSHEET_ACCESS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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

  if (Array.isArray(json) && json.length > 0) return json[0];
  return null;
}

async function updateAppSheetRow({ keyColumn, keyValue, text, tokens, specialist }) {
  const endpoint = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(
    APPSHEET_APP_ID,
  )}/tables/${encodeURIComponent(APPSHEET_TABLE)}/Action`;

  const rowObj = {
    [keyColumn]: keyValue,
    [COL_TEXT]: text,
    [COL_TOKENS]: tokens != null ? Number(tokens) : null,
  };

  if (specialist != null) rowObj[COL_SPECIALIST] = specialist;

  const body = {
    Action: "Edit",
    Properties: { Locale: "lt-LT", Timezone: "Europe/Vilnius" },
    Rows: [rowObj],
  };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      ApplicationAccessKey: APPSHEET_ACCESS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await resp.text();
  if (!resp.ok) throw new Error("AppSheet HTTP " + resp.status + ": " + truncate(raw, 500));

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
        cleaned.push(
          "Rekomenduojama vykdyti graužikų stebėseną ir palaikyti patalpų švarą bei sandarinti plyšius.",
        );
        continue;
      }
      if (/musių|musiu|muse|musių/.test(lower) || /muse/.test(lower)) {
        cleaned.push(
          "Rekomenduojama vykdyti musių stebėseną, palaikyti švarą ir tinkamai tvarkyti atliekas.",
        );
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
    finalText =
      "Kenkėjų nepastebėta; rekomenduojama tęsti stebėseną ir palaikyti patalpų švarą. " +
      finalText;
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
      /\b(garbage|trash|bin|container|dumpster|trashcan)\b/.test(s) || /\bšiukš/i.test(s),
    rodents:
      /\b(rodent|rodents|mouse|mice|rat|rats)\b/.test(s) || /\bgraužik/i.test(s),
    ceiling: /\b(ceiling|attic|loft)\b/.test(s) || /\blub|palub|palėp/i.test(s),
    droppings:
      /\b(dropping|droppings|feces|faeces|poo|stool)\b/.test(s) || /\bišmat/i.test(s),
  };

  if (has.flies && has.garbage) {
    return "Atlikta musių kontrolės apžiūra ir/ar priemonių prie šiukšlių konteinerio patikra; rekomenduojama palaikyti atliekų zonos švarą, laikyti konteinerius uždarytus ir reguliariai stebėti situaciją.";
  }
  if (has.rodents && has.ceiling && has.droppings) {
    return "Lubų zonoje nustatyti graužikų pėdsakai (rastos išmatos), atlikta masalų ar spąstų priežiūra; rekomenduojama sandarinti galimus patekimo taškus ir palaikyti švarą.";
  }
  if (has.rodents && has.ceiling) {
    return "Atlikta galimos graužikų veiklos lubų zonoje apžiūra ir masalų ar spąstų priežiūra; rekomenduojama sandarinti plyšius bei palaikyti rūsių ir viršutinių patalpų švarą.";
  }
  if (has.rodents) {
    return "Atlikta graužikų kontrolės priemonių apžiūra ir/ar masalų stotelių priežiūra; rekomenduojama palaikyti patalpų švarą, nesandėliuoti maisto ant grindų ir užsandarinti plyšius.";
  }
  if (has.flies) {
    return "Atlikta musių kontrolės priemonių apžiūra ar priežiūra; rekomenduojama palaikyti švarą, tinkamai tvarkyti atliekas ir stebėti musių aktyvumą.";
  }

  return String(ltGenerated || "").trim();
}

function injectIdentifier(src, out) {
  return String(out || "").trim();
}

// Only ensure pure numbers from source are present; do NOT touch IDs/codes
function injectNumbers(src, out) {
  const sourceText = String(src || "");
  let finalText = String(out || "").trim();

  const numericTokens = [];
  const reNumeric = /\b\d+(?:[\.,]\d+)?\b/g;
  let m;
  while ((m = reNumeric.exec(sourceText)) !== null) {
    const tok = m[0];
    if (tok && !numericTokens.includes(tok)) numericTokens.push(tok);
  }

  numericTokens.forEach((tok) => {
    if (tok && !finalText.includes(tok)) finalText += " " + tok;
  });

  return finalText.trim();
}
