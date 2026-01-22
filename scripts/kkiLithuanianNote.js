// ========== Groq Part (OpenAI-compatible Chat Completions via fetch) ==========

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.KKIOPENAPI; // allow backward compat
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b"; // pick a Groq-supported model

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
    "1. Nekeisk ir nešalink adresų, numerių, kodų ar žymų (pvz. \"Pietinė g. 9\", \"3 namo rūsiai\", \"(V25-0359430-10)\").\n" +
    "2. NEKURK naujų adresų, numerių, kodų, datų ar žymų – naudok tik tai, kas yra techniko tekste.\n" +
    "3. Tekstą rašyk lietuviškai ir ištaisyk rašybos, gramatikos bei skyrybos klaidas.\n" +
    "4. Pagal techniko tekstą aiškiai aprašyk, koks darbas atliktas (apžiūra, masalinių patikrinimas/papildymas, insekticidinis purškimas, paukščių atbaidymo priemonės ir pan.). " +
    "   NEKURK naujų paslaugų ar veiksmų, kurie nėra užsiminti pastaboje.\n" +
    "5. Visada pridėk trumputes bendrąsias rekomendacijas objektui, pritaikytas pagal kenkėjų tipą, jei jis aiškus. Jei kenkėjų tipas neaiškus, naudok neutralias rekomendacijas apie švarą, maisto laikymą ir plyšių sandarinimą.\n" +
    "6. Atsakymas turi tilpti į labai mažą vietą PDF formoje – MAKSIMALIAI 2 trumpi sakiniai, apie 30–40 žodžių iš viso. Vienas vientisas paragrafas, be sąrašų, be antraščių, be eilučių laužymo.\n" +
    "7. Nenaudok žodžio \"Rekomenduojama:\" kaip atskiros antraštės – rekomendacijos turi būti suformuluotos toje pačioje teksto dalyje kaip įprasti sakiniai.\n" +
    "8. Neperspausk su žodžiu \"aktyvumas\": jei pastaboje nėra aiškių aktyvumo įrodymų (išmatos, matyti graužikai, sugauti kenkėjai ir pan.), nerašyk, kad aktyvumas pastebėtas ar patvirtintas.\n" +
    "9. Jei aiškiai parašyta, kad kenkėjų nepastebėta (pvz. \"no pests observed\"), turi būti sakinys, kad kenkėjų nepastebėta, ir trumpa rekomendacija tęsti stebėseną.\n" +
    "10. Visus identifikatorius ir skaitines reikšmes (pvz. \"800m2\", \"22\", \"5 vnt\", \"3%\") palik nepakitusius – nekeisk nei pačių skaičių, nei jų formos.\n\n" +
    "REKOMENDACIJŲ ŠABLONAI PAGAL KENKĖJŲ TIPĄ (PRITAIKYK IR TRUMPINK, KAD TILPTŲ Į 1–2 SAKINIUS):\n" +
    "- Žiurkės ir pelės: paminėk plyšių ir skylių sandarinimą, rūsių ir sandėliavimo patalpų švarą, kad nepaliktų maisto atliekų ar grūdų ant grindų ir laikytų maistą sandariuose induose.\n" +
    "- Tarakonai: paminėk švarą virtuvėse ir sanitarinėse patalpose, kad naktį neliktų atvirų maisto produktų ir neplautų indų, pašalinti drėgmės šaltinius ir sandarinti plyšius aplink vamzdžius bei grindjuostes.\n" +
    "- Skruzdėlės: paminėk, kad nereikia palikti atvirų saldžių produktų, reikia nuvalyti maisto likučius ir užsandarinti plyšius aplink duris, langus ir grindis.\n" +
    "- Blusos: paminėk tekstilės (patalynės, gyvūnų gultų) skalbimą aukštoje temperatūroje ir naminių gyvūnų gydymą pagal veterinaro rekomendacijas.\n" +
    "- Paukščiai: paminėk, kad šalia pastato nereikia šerti paukščių, laikyti atliekų konteinerius uždarytus ir palaikyti balkonų, karnizų bei stogo švarą.\n" +
    "- Katės: paminėk, kad nereikia šerti benamių kačių prie įėjimų, laikyti duris ir atliekų konteinerius uždarytus, prireikus kreiptis į savivaldybę/gyvūnų kontrolę.\n" +
    "- Mišrūs užkrėtimai (pvz. \"skruzdėlės, tarakonai\"): naudok trumpą bendrą rekomendaciją apie švarą, maisto laikymą ir plyšių sandarinimą.\n\n" +
    "TEKSTO STRUKTŪRA:\n" +
    "- Pirma dalis: 1 trumpas sakinys (arba sakinio dalis) aiškiai aprašanti atliktus darbus vizito metu.\n" +
    "- Antra dalis: 1 trumpas sakinys su rekomendacijomis klientui, kiek įmanoma pritaikytomis pagal kenkėjų tipą.\n" +
    "- Maksimum 2 sakiniai, iš viso apie 30–40 žodžių.\n" +
    pestInfo +
    styleHint;

  const examples = [
    {
      role: "user",
      content:
        "Ziurkes. pakartotine grauziku deratizacija 3 namo rusy pietine g 9 (V25-0359430-10), patikrinom kelias stoteles, biski dadetas masalas",
    },
    {
      role: "assistant",
      content:
        "Atlikta pakartotinė griaužikų deratizacija 3 namo rūsiuose, Pietinės g. 9 (V25-0359430-10), patikrintos masalų stotelės ir papildytas masalas; rekomenduojama palaikyti rūsius švarius, nesandėliuoti maisto ant grindų ir užsandarinti plyšius.",
    },
    {
      role: "user",
      content:
        "Peles. peliu kontrole rusiai ir techn patalpos, papildem masalu stoteles ir pastatem nauju kur vaiksto, be kitu darbu",
    },
    {
      role: "assistant",
      content:
        "Atlikta pelių kontrolė rūsiuose ir techninėse patalpose, papildytos ir naujai išdėstytos masalų stotelės vietose, kur pastebimas judėjimas; rekomenduojama palaikyti patalpų švarą, nelaikyti maisto atliekų ant grindų ir sandariai laikyti produktus.",
    },
    {
      role: "user",
      content:
        "Tarakonai. tarakonu purskimas virtuvei ir san patalpose ausros g. 12 vilnius (V25-0123456-01), ispurksta aplink vamzdzius ir kriaukles",
    },
    {
      role: "assistant",
      content:
        "Atliktas tarakonų naikinimas virtuvės ir sanitarinėse patalpose Aušros g. 12, Vilnius (V25-0123456-01), apdorotos zonos aplink vamzdžius ir kriaukles; rekomenduojama palaikyti švarą, naktį nepalikti atvirų maisto likučių ir sandarinti plyšius.",
    },
  ];

  const userPrompt =
    "Techniko pastaba (gali būti EN/LT mix):\n" +
    inputText +
    "\n\n" +
    "Perrašyk šią pastabą pagal nurodytas taisykles, kad būtų tinkama trumpam įrašui PDF ataskaitoje: 1–2 trumpi sakiniai, apie 30–40 žodžių iš viso, vienas paragrafas be sąrašų ir be papildomų komentarų.\n" +
    "Jei tekste aiškiai minima, kad kenkėjų nepastebėta, turi būti aiškus sakinys apie tai ir rekomendacija tęsti stebėseną.\n" +
    "Jei pastaboje nenurodytas aktyvumas ar radiniai, nerašyk, kad aktyvumas buvo pastebėtas ar patvirtintas.\n" +
    "Palik visus kodus ir skaičius nepakitusius. Grąžink TIK galutinį lietuvišką tekstą, be kabučių ir paaiškinimų.";

  const messages = [{ role: "system", content: systemPrompt }, ...examples, { role: "user", content: userPrompt }];

  if (!GROQ_API_KEY) {
    throw new Error("Missing env GROQ_API_KEY (Groq API key).");
  }

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      presence_penalty: 0.0,
      frequency_penalty: 0.0,
      messages,
    }),
  });

  const raw = await resp.text();
  if (!resp.ok) {
    throw new Error("Groq HTTP " + resp.status + ": " + truncate(raw, 500));
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON from Groq: " + truncate(raw, 500));
  }

  const ltText =
    data?.choices?.[0]?.message?.content ||
    "";

  const totalTokens =
    data?.usage?.total_tokens ?? null;

  if (!String(ltText).trim()) {
    throw new Error("Groq returned empty content.");
  }

  return { ltText: String(ltText).trim(), totalTokens };
}
