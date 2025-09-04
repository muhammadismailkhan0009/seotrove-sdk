import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    minify: false,
    external: ['node:fs', 'node:path', 'node:fs/promises'],
    platform: 'node',
    target: 'node18',
    treeshake: true,
    outDir: 'dist',
});
