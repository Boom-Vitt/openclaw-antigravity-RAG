// ===================================================
// config.js — App Configuration
// ===================================================

const AppConfig = {
  // ── phaya.io Embedding API ──────────────────────
  apiEndpoint: "https://api.phaya.io/api/v1/embedding/create",
  defaultApiKey: "pk_ZalKxKe38QUTVtYQXS0KLOGWENGdwbHCBMVQwU5gajzw1mCN",
  modelName: "Qwen3 Embedding 8B",
  embeddingDims: 4096,

  // ── Supabase ────────────────────────────────────
  supabaseUrl: "https://rcudhdzgerjxstzegctd.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjdWRoZHpnZXJqeHN0emVnY3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjY1OTYsImV4cCI6MjA4NzA0MjU5Nn0.9adkmNuOFJw-1eJVMzJEhefuMNnr1kwbYK7I3b5LWAU",

  // ── Text chunking ───────────────────────────────
  chunkSize: 500,     // characters per chunk
  chunkOverlap: 50,   // overlap between chunks

  // Max preview chars shown per chunk in UI
  previewLength: 200,
};
