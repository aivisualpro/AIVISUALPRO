/**
 * Devco Backend Tester
 * Tests the devcoBackend webhook endpoint with sample estimate data
 * 
 * Usage: node scripts/devcoBackendTester.js
 */

const testPayload = {
    "Data": {
        "recordId": "6b293ad7",
        "estimate": "24-0001REV1-V.7",
        "date": "4/13/2025",
        "customerId": "uHZB6VkE",
        "customerName": "Property Owner Mike Tsai",
        "proposalNo": "24-0001REV1",
        "bidMarkUp": "30%",
        "directionalDrilling": "Y",
        "excavationBackfill": "N",
        "hydroExcavation": "N",
        "potholingCoring": "N",
        "asphaltConcrete": "",
        "fringe": ""
    }
};

async function testSaveEstimate() {
    console.log("🧪 Testing Devco Backend - Save Estimate");
    console.log("📤 Sending payload:", JSON.stringify(testPayload, null, 2));

    try {
        const response = await fetch("http://localhost:3000/webhook/devcoBackend", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(testPayload)
        });

        const result = await response.json();

        if (response.ok) {
            console.log("✅ Success!");
            console.log("📥 Response:", JSON.stringify(result, null, 2));
        } else {
            console.log("❌ Failed:", result);
        }
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

async function testGetEstimates() {
    console.log("\n🧪 Testing Devco Backend - Get All Estimates");

    try {
        const response = await fetch("http://localhost:3000/webhook/devcoBackend", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ action: "getEstimates" })
        });

        const result = await response.json();

        if (response.ok) {
            console.log("✅ Success!");
            console.log("📥 Estimates found:", result.result?.length || 0);
            console.log("📥 Response:", JSON.stringify(result, null, 2));
        } else {
            console.log("❌ Failed:", result);
        }
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

async function runTests() {
    await testSaveEstimate();
    await testGetEstimates();
}

runTests();
