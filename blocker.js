// blocker.js — Auto Life Logger
// Runs at document_start. Checks strict mode and injects a block screen
// before page content renders if the domain is blocked.
'use strict';

(async function checkBlock() {
  try {
    const domain = location.hostname.replace(/^www\./, '');
    if (!domain || location.protocol === 'chrome-extension:') return;

    const { settings } = await chrome.storage.local.get('settings');
    if (!settings?.strictMode?.enabled) return;

    const blocked = settings.strictMode.blockedDomains || [];
    if (!matchesDomain(domain, blocked)) return;

    // We need to check if user already bypassed this domain this session.
    // We can't share in-memory state with the service worker here,
    // so we use a sessionStorage flag as a bridge.
    const bypassKey = `all_bypass_${domain}`;
    const bypassUntil = Number(sessionStorage.getItem(bypassKey) || 0);
    if (bypassUntil > Date.now()) return;
    sessionStorage.removeItem(bypassKey);

    // Inject block screen
    injectBlockScreen(domain, settings.strictMode);
  } catch { /* extension context may not be ready — fail silently */ }
})();

function injectBlockScreen(domain, strictMode = {}) {
  const safeDomain = escHtml(domain);
  // Use document.write since document_start means DOM is empty
  // We override the page completely
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Site Blocked — Auto Life Logger</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:#0d0d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e8eaf6;display:flex;align-items:center;justify-content:center}
.block-wrap{text-align:center;padding:32px 24px;max-width:420px;animation:up .4s ease-out both}
@keyframes up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.block-icon{font-size:56px;margin-bottom:20px;filter:drop-shadow(0 0 20px rgba(233,69,96,.5))}
.block-title{font-size:24px;font-weight:800;letter-spacing:-.4px;margin-bottom:8px}
.block-domain{color:#ff6868;font-size:16px;font-weight:600;margin-bottom:20px}
.block-msg{font-size:14px;color:#8891b2;line-height:1.6;margin-bottom:28px}
.btns{display:flex;flex-direction:column;gap:10px}
.btn-back{background:linear-gradient(135deg,#6ecb93,#49a7a1);color:#07110d;border:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;transition:opacity .15s}
.btn-back:hover{opacity:.85}
.btn-bypass{background:rgba(255,255,255,.05);color:#4a5070;border:1px solid rgba(255,255,255,.07);padding:11px 24px;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;transition:background .15s,color .15s}
.btn-bypass:hover{background:rgba(255,255,255,.09);color:#8891b2}
.footer{margin-top:24px;font-size:11px;color:#3d4460}
</style>
</head>
<body>
<div class="block-wrap">
  <div class="block-icon">🔒</div>
  <div class="block-title">Site Blocked</div>
  <div class="block-domain">${safeDomain}</div>
  <div class="block-msg">
    This site has been blocked by <strong>Auto Life Logger Strict Mode</strong> after repeated distraction violations.<br><br>
    Stay on track. You've got work to do.
  </div>
  <div class="btns">
    <button class="btn-back" id="backBtn">← Go Back</button>
    <button class="btn-bypass" id="bypassBtn"${strictMode.hardLockUntilTomorrow ? ' disabled' : ''}>${strictMode.hardLockUntilTomorrow ? 'Bypass Disabled' : 'Bypass Temporarily'}</button>
  </div>
  <div class="footer">Auto Life Logger · Strict Mode Active</div>
</div>
</body>
</html>`;

  document.open();
  document.write(html);
  document.close();

  document.getElementById('backBtn')?.addEventListener('click', () => history.back());
  const bypassBtn = document.getElementById('bypassBtn');
  if (bypassBtn) {
    bypassBtn.addEventListener('click', () => {
      if (strictMode.hardLockUntilTomorrow) return;
      if (!confirm(`Disable strict mode for ${domain} this session? Your violation count will remain.`)) return;
      const minutes = Number(strictMode.bypassMinutes) || 30;
      sessionStorage.setItem(`all_bypass_${domain}`, String(Date.now() + minutes * 60000));
      chrome.runtime.sendMessage({ type: 'STRICT_UNBLOCK_TEMP', payload: { domain } }).catch(() => {});
      location.reload();
    });
  }
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

function matchesDomain(domain, patterns) {
  return Array.isArray(patterns) && patterns.some(d => domain === d || domain.endsWith('.' + d));
}
