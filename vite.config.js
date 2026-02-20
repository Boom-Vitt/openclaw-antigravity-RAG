import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                chat: resolve(__dirname, 'chat.html'),
            },
        },
        // Copy non-module scripts as static assets
        copyPublicDir: true,
    },
    // Files in "public/" are copied as-is to dist root
    publicDir: 'public',
});
