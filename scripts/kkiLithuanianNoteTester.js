// scripts/kkiLithuanianNoteTester.js
import "dotenv/config";
import kkiLithuanianNote from "./kkiLithuanianNote.js";

async function runTest() {
    const testData = {
        
        recordid: "10101",
        Speciality:"Specialisto vardas",
        pestTypes: "Ziurkes",

        text: "pakartotine grauziku deratizacija 3 namo rusy pietine g 9 (V25-0359430-10), patikrinom kelias stoteles, biski dadetas masalas",
        
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
