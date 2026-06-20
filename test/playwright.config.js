export default {
  testDir: './cases',
  timeout: 120_000,          // 2 min per test — ServiceNow boards are slow to load
  use: {
    trace:      'on',        // full trace every run; open at trace.playwright.dev
    screenshot: 'on',
    video:      'retain-on-failure',
  },
  reporter: [['html', { open: 'never' }]],
};
