/**
 * upload_embeddings.mjs
 * ──────────────────────────────────────────────────────────
 * Zero-dependency script — uses only built-in Node.js fetch.
 * Chunks sample_thai.txt → embeds via phaya.io → saves to Supabase REST API.
 *
 * Usage:  node upload_embeddings.mjs [file.txt]
 * Requires: Node.js 18+
 */

import { readFileSync } from "fs";
import { basename } from "path";

// ── Config ─────────────────────────────────────────────────
const PHAYA_ENDPOINT = "https://api.phaya.io/api/v1/embedding/create";
const PHAYA_KEY = "pk_ZalKxKe38QUTVtYQXS0KLOGWENGdwbHCBMVQwU5gajzw1mCN";
const MODEL_NAME = "Qwen3 Embedding 8B";

const SUPABASE_URL = "https://rcudhdzgerjxstzegctd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjdWRoZHpnZXJqeHN0emVnY3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjY1OTYsImV4cCI6MjA4NzA0MjU5Nn0.9adkmNuOFJw-1eJVMzJEhefuMNnr1kwbYK7I3b5LWAU";

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

// ── Supabase REST helpers ──────────────────────────────────
const SB_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
};

async function sbInsert(table, rows) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: SB_HEADERS,
        body: JSON.stringify(rows),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${table} insert ${res.status}: ${text}`);
    return JSON.parse(text);
}

// ── phaya.io helper ────────────────────────────────────────
async function getEmbedding(text) {
    const res = await fetch(PHAYA_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${PHAYA_KEY}`,
        },
        body: JSON.stringify({ input: [text] }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`phaya.io ${res.status}: ${err}`);
    }
    const data = await res.json();
    if (!data.success || !data.data?.[0]?.embedding)
        throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
    return data.data[0].embedding; // float[]
}

// ── Chunker ────────────────────────────────────────────────
function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + size, text.length);
        const chunk = text.slice(start, end).trim();
        if (chunk.length > 0) chunks.push(chunk);
        if (end >= text.length) break;
        start += size - overlap;
    }
    return chunks;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ───────────────────────────────────────────────────
const filePath = process.argv[2] || "./sample_thai.txt";
const fileName = basename(filePath);
const rawText = readFileSync(filePath, "utf-8").trim();
const chunks = chunkText(rawText);

console.log(`\n📄  File      : ${fileName}`);
console.log(`📏  Chars     : ${rawText.length}`);
console.log(`✂️   Chunks    : ${chunks.length}`);

// 1. Insert document ─────────────────────────────────────────
console.log("\n📥  Inserting document…");
const [docRow] = await sbInsert("documents", {
    title: `[${fileName}]`,
    source_file: fileName,
    content: rawText,
    file_type: "txt",
    char_count: rawText.length,
    metadata: { model: MODEL_NAME, chunk_size: CHUNK_SIZE, chunk_overlap: CHUNK_OVERLAP },
});
const documentId = docRow.id;
console.log(`✅  Document id: ${documentId}`);

// 2. Embed each chunk ────────────────────────────────────────
console.log("\n🔄  Generating embeddings…\n");
const chunkRows = [];

for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    process.stdout.write(`   [${i + 1}/${chunks.length}]  ${chunk.length} chars… `);
    const embedding = await getEmbedding(chunk);
    chunkRows.push({
        document_id: documentId,
        chunk_index: i,
        content: chunk,
        embedding: JSON.stringify(embedding),
        token_count: Math.ceil(chunk.length / 4),
    });
    console.log(`✅  dims=${embedding.length}`);
    if (i < chunks.length - 1) await sleep(300);
}

// 3. Batch-insert chunks ─────────────────────────────────────
console.log(`\n💾  Saving ${chunkRows.length} chunks to Supabase…`);
await sbInsert("chunks", chunkRows);

console.log(`\n🎉  Complete!`);
console.log(`   Document ID : ${documentId}`);
console.log(`   Chunks      : ${chunkRows.length}`);
console.log(`   Model       : ${MODEL_NAME}`);
console.log(`   Dimensions  : 4096\n`);
