// scripts/kkiLithuanianNoteTester.js
import "dotenv/config";
import kkiLithuanianNote from "./kkiLithuanianNote.js";

async function runTest() {
    const testData = {
        
        recordid: "10110",
        
        pestTypes: "Skruzdels, tarakonai",

        text: "Skruzdels, tarakonai",
        
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
