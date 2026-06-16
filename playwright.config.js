const { defineConfig } = require("playwright/test");

module.exports = defineConfig({
  // PW_CHANNEL unset -> bundled chromium (CI). Set PW_CHANNEL=chrome to drive the
  // system Google Chrome where Playwright has no prebuilt chromium for the OS.
  use: { channel: process.env.PW_CHANNEL },
  reporter: [["list"]],
});
