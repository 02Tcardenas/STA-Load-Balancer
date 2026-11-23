import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  base: './',
  esbuild: { jsx: 'automatic' },
  plugins: mode === 'projector' ? [viteSingleFile({ removeViteModuleLoader: true })] : [],
  build: { outDir: mode === 'projector' ? 'dist/projector' : 'dist/site' },
}));
