import { defineConfig } from '@playwright/test';
import app from './playwright.app.config';
export default defineConfig(app, {
  testMatch: 'heic.spec.ts',
  testIgnore: [],
  use: { baseURL: process.env.HEIC_TEST_URL ?? 'http://127.0.0.1:34020' },
});
