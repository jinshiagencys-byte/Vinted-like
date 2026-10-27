import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vitest transpile avec esbuild, qui n'émet pas `emitDecoratorMetadata`.
  // Sans métadonnées, l'injection par type de NestJS échoue : on repasse par
  // SWC en mode décorateurs historiques + métadonnées.
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
      module: { type: 'es6' },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['test/integration/**'],
    restoreMocks: true,
  },
});
