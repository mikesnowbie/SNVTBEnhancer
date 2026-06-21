export default {
  testDir:   './cases',
  testMatch: '**/*.js',
  timeout:   120_000,        // 2 min per test — ServiceNow boards are slow to load
  workers:   1,              // test files share a persistent Edge profile — must run serially
  use: {
    trace:      'on',        // full trace every run; open at trace.playwright.dev
    screenshot: 'on',
    video:      'retain-on-failure',
  },
  outputDir:  '../test-local/test-results',
  reporter: [['html', { open: 'never', outputFolder: '../test-local/playwright-report' }]],
};
