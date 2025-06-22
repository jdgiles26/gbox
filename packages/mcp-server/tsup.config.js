/** @type {import('tsup').Options} */
export default {
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node18',
    sourcemap: true,
    clean: true,
    minify: false,
    dts: true,
    splitting: false,
    keepNames: true,
    external: [
        'node:*',
        'playwright',
        'playwright-core',
        'chromium-bidi',
        '@playwright/test'
    ],
    banner: {
        js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
    },
    outDir: 'dist',
} 