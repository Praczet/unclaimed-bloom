import { defineConfig } from 'vite';

const apiPort = Number(process.env['UB_WORKBENCH_PORT'] ?? 7865);
const uiPort = Number(process.env['UB_WORKBENCH_UI_PORT'] ?? 5173);

export default defineConfig({
    root: 'src/ui',
    server: {
        port: uiPort,
        proxy: {
            '/api': `http://localhost:${apiPort}`,
            '/ws':  { target: `ws://localhost:${apiPort}`, ws: true },
        },
    },
    build: {
        outDir:    '../../dist/ui',
        emptyOutDir: true,
    },
});
