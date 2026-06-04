import { defineConfig } from 'vite';

export default defineConfig({
    root: 'src/ui',
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:7865',
            '/ws':  { target: 'ws://localhost:7865', ws: true },
        },
    },
    build: {
        outDir:    '../../dist/ui',
        emptyOutDir: true,
    },
});
