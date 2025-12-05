// scripts/kkiLithuanianNoteTester.js
import "dotenv/config";
import kkiLithuanianNote from "./kkiLithuanianNote.js";

async function runTest() {
    const testData = {
        text: "Atlikta pakartotinė griaužikų deratizacija 3 namo rūsiuose. Pietinė g.9 (V25-0359430-10).",
        recordid: "10101",
        // can be either "pestType" or "pestTypes" – script maps it internally
        pestTypes: "Andrius Čepas",
        // optional extras if your script uses them:
        // keyColumn: "Form ID",
        // templates: true,
    };

    try {
        const result = await kkiLithuanianNote(testData);
        console.log("✅ kkiLithuanianNote test result:");
        console.dir(result, { depth: null });
    } catch (err) {
        console.error("❌ kkiLithuanianNote test error:");
        console.error(err);
    }
}

runTest();
