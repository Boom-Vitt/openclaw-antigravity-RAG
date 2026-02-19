// ===================================================
// app.js — Core Logic: phaya.io Embeddings + Supabase
// ===================================================

// ── Supabase client ────────────────────────────────
const { createClient } = window.supabase;
const db = createClient(AppConfig.supabaseUrl, AppConfig.supabaseAnonKey);

// ── State ──────────────────────────────────────────
const state = {
    rawText: "",
    fileInfo: null,
    chunks: [],
    embeddings: [],
    savedDocumentId: null,
    isLoading: false,
};

// ── DOM refs ───────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Init ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    // Pre-fill API key from config
    $("api-key").value = AppConfig.defaultApiKey;
    // Show fixed model name
    $("model-display").textContent = `${AppConfig.modelName} (${AppConfig.embeddingDims}d)`;
    // Populate chunk settings
    $("chunk-size").value = AppConfig.chunkSize;
    $("chunk-overlap").value = AppConfig.chunkOverlap;

    setupTabs();
    setupDropzone();
    setupApiKeyToggle();
    setupEventListeners();
    checkSupabaseConnection();
});

// ── Check Supabase connection ──────────────────────
async function checkSupabaseConnection() {
    try {
        const { error } = await db.from("documents").select("id").limit(1);
        if (error) throw error;
        $("supabase-status").className = "supabase-badge connected";
        $("supabase-status").textContent = "🟢 Supabase เชื่อมต่อแล้ว";
    } catch {
        $("supabase-status").className = "supabase-badge error";
        $("supabase-status").textContent = "🔴 Supabase ไม่สามารถเชื่อมต่อได้";
    }
}

// ── Tab switching ──────────────────────────────────
function setupTabs() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.tab;
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
            btn.classList.add("active");
            $(target).classList.add("active");
            state.rawText = "";
            state.fileInfo = null;
            updateFileInfo(null);
            hideResults();
        });
    });
}

// ── Dropzone ───────────────────────────────────────
function setupDropzone() {
    const zone = $("dropzone");
    const input = $("file-input");

    zone.addEventListener("dragover", e => {
        e.preventDefault();
        zone.classList.add("drag-over");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", e => {
        e.preventDefault();
        zone.classList.remove("drag-over");
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });
    input.addEventListener("change", () => {
        if (input.files[0]) handleFile(input.files[0]);
    });
}

// ── Handle uploaded file ───────────────────────────
async function handleFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["txt", "docx"].includes(ext)) {
        showStatus("error", "⚠️ รองรับเฉพาะไฟล์ .txt และ .docx เท่านั้น");
        return;
    }

    showStatus("info", "⏳ กำลังอ่านไฟล์...");

    try {
        if (ext === "txt") {
            state.rawText = await readTxtFile(file);
        } else {
            state.rawText = await readDocxFile(file);
        }

        state.fileInfo = { name: file.name, size: file.size, ext };
        $("dropzone").classList.add("has-file");
        updateFileInfo(state.fileInfo);
        showStatus("success", `✅ อ่านไฟล์สำเร็จ — ${state.rawText.length.toLocaleString()} ตัวอักษร`);
        hideResults();
        updateChunkPreview();
    } catch (err) {
        showStatus("error", `❌ เกิดข้อผิดพลาด: ${err.message}`);
    }
}

// Read plain text file ─────────────────────────────
function readTxtFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ได้"));
        reader.readAsText(file, "UTF-8");
    });
}

// Read .docx using mammoth.js ──────────────────────
function readDocxFile(file) {
    return new Promise((resolve, reject) => {
        if (typeof mammoth === "undefined") {
            reject(new Error("ไม่พบ mammoth.js — กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต"));
            return;
        }
        const reader = new FileReader();
        reader.onload = async e => {
            try {
                const arrayBuffer = e.target.result;
                const result = await mammoth.extractRawText({ arrayBuffer });
                resolve(result.value);
            } catch (err) {
                reject(new Error("ไม่สามารถแปลงไฟล์ Word ได้: " + err.message));
            }
        };
        reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ได้"));
        reader.readAsArrayBuffer(file);
    });
}

// ── Update file info display ───────────────────────
function updateFileInfo(info) {
    const el = $("file-info");
    if (!info) {
        el.classList.remove("visible");
        return;
    }
    const icon = info.ext === "docx" ? "📄" : "📝";
    const size = info.size < 1024
        ? `${info.size} B`
        : info.size < 1024 * 1024
            ? `${(info.size / 1024).toFixed(1)} KB`
            : `${(info.size / 1024 / 1024).toFixed(2)} MB`;

    $("file-name-display").textContent = info.name;
    $("file-meta-display").textContent = `${info.ext === "docx" ? "Word Document" : "Text File"} · ${size}`;
    $("file-icon-display").textContent = icon;
    el.classList.add("visible");
}

// ── API key toggle ─────────────────────────────────
function setupApiKeyToggle() {
    const btn = $("toggle-api-key");
    const input = $("api-key");
    btn.addEventListener("click", () => {
        if (input.type === "password") {
            input.type = "text";
            btn.textContent = "🙈";
        } else {
            input.type = "password";
            btn.textContent = "👁";
        }
    });
}

// ── Event listeners ────────────────────────────────
function setupEventListeners() {
    $("remove-file-btn").addEventListener("click", () => {
        state.rawText = "";
        state.fileInfo = null;
        $("file-input").value = "";
        $("dropzone").classList.remove("has-file");
        updateFileInfo(null);
        clearStatus();
        hideResults();
    });

    $("embed-btn").addEventListener("click", handleEmbed);

    $("chunk-size").addEventListener("input", updateChunkPreview);
    $("chunk-overlap").addEventListener("input", updateChunkPreview);

    $("copy-json-btn").addEventListener("click", copyResultsJson);
    $("download-json-btn").addEventListener("click", downloadResultsJson);
    $("download-txt-btn").addEventListener("click", downloadExtractedText);
}

// ── Main embedding handler ─────────────────────────
async function handleEmbed() {
    // Get text from active tab
    const activeTab = document.querySelector(".tab-panel.active");
    let text = "";

    if (activeTab.id === "tab-file") {
        text = state.rawText;
        if (!text) { showStatus("error", "⚠️ กรุณาอัปโหลดไฟล์ก่อน"); return; }
    } else {
        text = $("manual-text").value.trim();
        if (!text) { showStatus("error", "⚠️ กรุณาพิมพ์ข้อความก่อน"); return; }
        state.rawText = text;
    }

    const apiKey = $("api-key").value.trim();
    if (!apiKey) { showStatus("error", "⚠️ กรุณาใส่ API Key ก่อน"); return; }

    const chunkSize = parseInt($("chunk-size").value, 10) || AppConfig.chunkSize;
    const chunkOverlap = parseInt($("chunk-overlap").value, 10) || AppConfig.chunkOverlap;

    // Chunk text
    state.chunks = chunkText(text, chunkSize, chunkOverlap);
    if (state.chunks.length === 0) { showStatus("error", "⚠️ ไม่พบข้อความที่จะประมวลผล"); return; }

    // ── Phase 1: Generate embeddings ────────────────
    setLoading(true);
    showProgress(0, `กำลังสร้าง embeddings สำหรับ ${state.chunks.length} chunk...`);

    try {
        state.embeddings = [];
        for (let i = 0; i < state.chunks.length; i++) {
            const emb = await fetchEmbedding(state.chunks[i], apiKey);
            state.embeddings.push(emb);
            const pct = Math.round(((i + 1) / state.chunks.length) * 80); // 0–80%
            showProgress(pct, `Chunk ${i + 1} / ${state.chunks.length} — สร้าง embedding แล้ว`);
        }

        // ── Phase 2: Save to Supabase ──────────────────
        showProgress(85, "💾 กำลังบันทึกลง Supabase...");
        const savedOk = await saveToSupabase(state.chunks, state.embeddings);

        showProgress(100, savedOk ? "✅ บันทึกสำเร็จ!" : "⚠️ บันทึกไม่สำเร็จ — ดูผลลัพธ์ด้านล่าง");

        showStatus("success", `🎉 สร้าง embeddings สำเร็จ ${state.chunks.length} chunk${savedOk ? " · 💾 บันทึกลง Supabase แล้ว" : ""}`);
        renderResults(state.chunks, state.embeddings, savedOk);

    } catch (err) {
        showStatus("error", `❌ เกิดข้อผิดพลาด: ${err.message}`);
        hideProgress();
    } finally {
        setLoading(false);
    }
}

// ── Text chunking ──────────────────────────────────
function chunkText(text, size, overlap) {
    const clean = text.replace(/\r\n/g, "\n").trim();
    if (clean.length === 0) return [];

    const chunks = [];
    let start = 0;
    while (start < clean.length) {
        const end = Math.min(start + size, clean.length);
        chunks.push(clean.slice(start, end));
        if (end === clean.length) break;
        start += size - overlap;
    }
    return chunks;
}

// ── Fetch embedding from phaya.io ──────────────────
async function fetchEmbedding(text, apiKey) {
    const res = await fetch(AppConfig.apiEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        // phaya.io format: { input: [text] }
        body: JSON.stringify({ input: [text] }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
            err.error?.message || err.message || `HTTP ${res.status}: ${res.statusText}`
        );
    }

    const data = await res.json();

    // phaya.io response: { success, data: [{ embedding: [...] }] }
    if (!data.success || !data.data?.[0]?.embedding) {
        throw new Error("รูปแบบการตอบกลับจาก phaya.io ไม่ถูกต้อง");
    }
    return data.data[0].embedding;
}

// ── Save document + chunks to Supabase ────────────
async function saveToSupabase(chunks, embeddings) {
    try {
        const fileInfo = state.fileInfo;
        const title = fileInfo?.name?.replace(/\.[^.]+$/, "") || "Manual Text";

        // 1. Insert document
        const { data: doc, error: docErr } = await db
            .from("documents")
            .insert({
                title,
                source_file: fileInfo?.name || null,
                content: state.rawText,
                file_type: fileInfo?.ext || "text",
                char_count: state.rawText.length,
                metadata: {
                    chunk_count: chunks.length,
                    model: AppConfig.modelName,
                    embedding_dims: AppConfig.embeddingDims,
                },
            })
            .select()
            .single();

        if (docErr) throw docErr;
        state.savedDocumentId = doc.id;

        // 2. Insert all chunks with embeddings
        const chunkRows = chunks.map((content, i) => ({
            document_id: doc.id,
            chunk_index: i,
            content,
            // pgvector expects a string like "[0.1, -0.2, ...]"
            embedding: JSON.stringify(embeddings[i]),
            token_count: Math.ceil(content.length / 3.5), // rough estimate
        }));

        const { error: chunkErr } = await db.from("chunks").insert(chunkRows);
        if (chunkErr) throw chunkErr;

        return true;
    } catch (err) {
        console.error("Supabase save error:", err);
        return false;
    }
}

// ── Render results ─────────────────────────────────
function renderResults(chunks, embeddings, savedOk) {
    // Stats
    $("stat-chunks").textContent = chunks.length;
    $("stat-chars").textContent = state.rawText.length.toLocaleString();
    $("stat-dims").textContent = embeddings[0]?.length ?? "—";
    $("stat-model").textContent = "Qwen3";

    // Supabase save status
    const saveEl = $("save-status");
    if (savedOk) {
        saveEl.className = "save-status saved";
        saveEl.innerHTML = `💾 บันทึกลง Supabase แล้ว${state.savedDocumentId ? ` <span class="doc-id">ID: ${state.savedDocumentId.slice(0, 8)}…</span>` : ""}`;
    } else {
        saveEl.className = "save-status failed";
        saveEl.innerHTML = `⚠️ ไม่สามารถบันทึกลง Supabase ได้`;
    }

    // Chunks list
    const list = $("chunks-list");
    list.innerHTML = "";
    chunks.forEach((text, i) => {
        const emb = embeddings[i];
        const preview = emb ? `[${emb.slice(0, 6).map(v => v.toFixed(5)).join(", ")}, ...]` : "N/A";
        const charCount = text.length;

        const item = document.createElement("div");
        item.className = "chunk-item fade-up";
        item.style.animationDelay = `${Math.min(i * 40, 400)}ms`;
        item.innerHTML = `
      <div class="chunk-meta">
        <span class="chunk-index">CHUNK ${String(i + 1).padStart(3, "0")}</span>
        <span class="chunk-chars">${charCount.toLocaleString()} ตัวอักษร</span>
        <button class="btn btn-ghost btn-sm chunk-copy" onclick="copyChunk(${i})" data-tooltip="คัดลอก JSON">📋 คัดลอก</button>
      </div>
      <div class="chunk-text">${escHtml(text.slice(0, AppConfig.previewLength))}${text.length > AppConfig.previewLength ? "<span style='color:var(--text-muted)'>…</span>" : ""}</div>
      <div class="embedding-preview">${escHtml(preview)}</div>
    `;
        list.appendChild(item);
    });

    $("results-section").classList.add("visible", "fade-up");
    $("results-section").scrollIntoView({ behavior: "smooth", block: "start" });

    setTimeout(hideProgress, 800);
}

// ── Copy individual chunk ──────────────────────────
function copyChunk(i) {
    const data = { chunk_index: i, text: state.chunks[i], embedding: state.embeddings[i] };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
        .then(() => showStatus("success", "✅ คัดลอก chunk แล้ว"))
        .catch(() => showStatus("error", "❌ ไม่สามารถคัดลอกได้"));
}

// ── Copy all results as JSON ───────────────────────
function copyResultsJson() {
    const json = buildOutputJson();
    navigator.clipboard.writeText(json)
        .then(() => showStatus("success", "✅ คัดลอก JSON ทั้งหมดแล้ว"))
        .catch(() => showStatus("error", "❌ ไม่สามารถคัดลอกได้"));
}

// ── Download results as JSON ───────────────────────
function downloadResultsJson() {
    downloadFile(buildOutputJson(), "embeddings.json", "application/json");
}

// ── Download extracted text ────────────────────────
function downloadExtractedText() {
    downloadFile(state.rawText, "extracted_text.txt", "text/plain;charset=utf-8");
}

function buildOutputJson() {
    const output = state.chunks.map((text, i) => ({
        chunk_index: i,
        text,
        embedding: state.embeddings[i] || null,
    }));
    return JSON.stringify({
        model: AppConfig.modelName,
        embedding_dims: AppConfig.embeddingDims,
        document_id: state.savedDocumentId,
        chunks: output,
    }, null, 2);
}

function downloadFile(content, filename, mimeType) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

// ── Chunk preview update ───────────────────────────
function updateChunkPreview() {
    const text = state.rawText || $("manual-text").value.trim();
    if (!text) return;
    const size = parseInt($("chunk-size").value, 10) || AppConfig.chunkSize;
    const overlap = parseInt($("chunk-overlap").value, 10) || AppConfig.chunkOverlap;
    const chunks = chunkText(text, size, overlap);
    $("chunk-preview-count").textContent = `≈ ${chunks.length} chunk`;
}

// ── UI helpers ─────────────────────────────────────
function setLoading(loading) {
    state.isLoading = loading;
    const btn = $("embed-btn");
    if (loading) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> กำลังประมวลผล...`;
    } else {
        btn.disabled = false;
        btn.innerHTML = `✨ สร้าง Embeddings`;
    }
}

function showProgress(pct, label) {
    $("progress-wrap").classList.add("visible");
    $("progress-bar").style.width = pct + "%";
    $("progress-label").classList.add("visible");
    $("progress-label").textContent = label;
}

function hideProgress() {
    $("progress-wrap").classList.remove("visible");
    $("progress-label").classList.remove("visible");
}

function showStatus(type, msg) {
    const el = $("status-msg");
    el.className = `status-msg visible ${type}`;
    el.innerHTML = msg;
}
function clearStatus() {
    $("status-msg").className = "status-msg";
}

function hideResults() {
    $("results-section").classList.remove("visible");
}

function escHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}
