import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  splitting: false,
  clean: true,
  external: ['tar'],
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? `.js` : `.mjs`,
    };
  },
});
