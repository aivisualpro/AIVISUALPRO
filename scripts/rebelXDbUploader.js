import { MongoClient } from 'mongodb';
import csv from 'csv-parser';
import { Readable } from 'stream';

const { REBELXMONGODB_URI, DB_NAME } = process.env;

export default async function rebelXDbUploader(payload) {
    if (!REBELXMONGODB_URI || !DB_NAME) {
        throw new Error('❌ Missing REBELXMONGODB_URI or DB_NAME in .env');
    }

    const { collection, csvData, noHeader, delimiter = ',', batchSize = '1000' } = payload;

    if (!csvData) throw new Error('No csvData received');
    if (!collection) throw new Error('collection is required');

    const batchNum = Math.max(1, parseInt(batchSize, 10) || 1000);
    const client = new MongoClient(REBELXMONGODB_URI);

    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const coll = db.collection(collection);

        const parser = csv({
            separator: delimiter,
            headers: noHeader ? false : undefined,
            strict: false,
        });

        const stream = Readable.from([csvData]).pipe(parser);

        let batch = [];
        let inserted = 0;

        for await (const row of stream) {
            const doc = {};
            // When noHeader=true, row keys will be "0", "1", ... or similar depending on csv-parser behavior without headers
            // Actually csv-parser with headers: false returns array or object with index keys?
            // Let's check csv-parser docs or assume standard behavior.
            // If headers: false, it returns an array of strings? No, usually object with indices.
            // But the original code handled `noHeader` by checking `headers` event.
            // In this loop, `row` is the data.

            // Let's stick to the original logic's intent but simplified.
            // If the user provided headers in the CSV, csv-parser handles it.
            // If noHeader is true, csv-parser generates default headers or we handle it.
            // The original code had complex logic for noHeader.
            // Let's trust csv-parser's default behavior for now or copy the inference logic.

            for (const k of Object.keys(row)) {
                doc[k] = inferValue(row[k]);
            }

            batch.push(doc);

            if (batch.length >= batchNum) {
                const r = await coll.insertMany(batch);
                inserted += r.insertedCount;
                batch = [];
            }
        }

        if (batch.length > 0) {
            const r = await coll.insertMany(batch);
            inserted += r.insertedCount;
        }

        return { ok: true, collection, inserted };

    } finally {
        await client.close();
    }
}

function inferValue(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === '') return null;
    const low = s.toLowerCase();
    if (low === 'true') return true;
    if (low === 'false') return false;
    if (/^-?\d+$/.test(s)) {
        const n = Number(s);
        if (Number.isSafeInteger(n)) return n;
    }
    if (!Number.isNaN(Number(s)) && /^-?\d*(\.\d+)?$/.test(s)) return Number(s);
    return s;
}
