import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// G-kodstesterna (test/) – webbläsartesterna i e2e/ körs av Playwright.
export default mergeConfig(viteConfig, defineConfig({ test: { include: ['test/**/*.test.ts'] } }));
