import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  splitting: false,
  clean: true,
  external: ['tar', 'axios', 'util', 'stream', 'http', 'https', 'zlib', 'form-data', 'combined-stream'],
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? `.js` : `.mjs`,
    };
  },
});
