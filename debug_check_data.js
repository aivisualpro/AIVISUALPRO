
import dotenv from 'dotenv';
import backend from './scripts/skynetBackend.js';

dotenv.config();

async function run() {
    try {
        console.log("Creating test proposal...");
        const testPayload = {
            clientId: null, // might fail if schema requires ref? Schema: clientId: { type: ObjectId, ref: 'Client' }. 
            // Better to find a client first.
        };

        // 1. Get Client
        const clients = await backend({ action: 'getClients' });
        if (clients.length === 0) {
            console.log("No clients found to test with.");
            // create one?
        }
        const client = clients[0];
        console.log("Using client:", client.name);

        // 2. Save Proposal
        const newProp = await backend({
            action: 'saveProposal',
            payload: {
                clientId: client._id,
                clientName: client.name,
                clientEmail: client.email,
                title: "DEBUG TEST PROPOSAL",
                content: "<h1>Test</h1>",
                formData: {
                    overview: "Debug Overview",
                    pay1Name: "Debug Pay 1"
                }
            }
        });
        console.log("Created Proposal ID:", newProp._id);

        // 3. Fetch specific
        const fetched = await backend({ action: 'getProposalById', payload: { id: newProp._id } });
        console.log("Fetched formData:", fetched.formData);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
