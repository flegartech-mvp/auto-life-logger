# Release Checklist

1. Update `manifest.json` and `package.json` to the same version.
2. Run `npm.cmd run validate` on Windows, or `npm run validate` on macOS/Linux.
3. Run `npm.cmd run package` on Windows, or `npm run package` on macOS/Linux.
4. Upload the generated zip from `dist/` to the Chrome Web Store.
5. Use `STORE_LISTING.md` for the listing copy and `PRIVACY.md` for the privacy policy.
6. Complete the manual checks in `QA_CHECKLIST.md` before publishing.
