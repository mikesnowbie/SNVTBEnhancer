export default {
  testDir:   './cases',
  testMatch: '**/*.js',
  timeout:   120_000,        // 2 min per test — ServiceNow boards are slow to load
  workers:   1,              // test files share a persistent Edge profile — must run serially
  use: {
    // Keep trace, screenshot, and video only on failure — open traces at trace.playwright.dev.
    trace:      'retain-on-failure',
    screenshot: 'only-on-failure',
    video:      'retain-on-failure',
  },
  outputDir:  '../test-local/test-results',
  reporter: [['html', { open: 'never', outputFolder: '../test-local/playwright-report' }]],
};
