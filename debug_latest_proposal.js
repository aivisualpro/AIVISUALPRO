
import dotenv from 'dotenv';
import backend from './scripts/skynetBackend.js';

dotenv.config();

async function run() {
    try {
        console.log("Fetching all proposals...");
        const result = await backend({ action: 'getProposals' });

        if (result.length === 0) {
            console.log("No proposals found.");
            process.exit(0);
        }

        const latest = result[0]; // sort is { createdAt: -1 } so first is latest
        console.log(`\n--- LATEST PROPOSAL (${latest._id}) ---`);
        console.log(`Title: "${latest.title}"`);
        console.log(`Client: ${latest.clientName}`);
        console.log(`Content Length: ${latest.content ? latest.content.length : 0}`);
        console.log(`Content Preview: ${latest.content ? latest.content.substring(0, 100) + '...' : 'NULL/EMPTY'}`);

        console.log(`Has formData? ${!!latest.formData}`);
        if (latest.formData) {
            console.log('formData Overview:', latest.formData.overview);
            console.log('formData Pay1Name:', latest.formData.pay1Name);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
