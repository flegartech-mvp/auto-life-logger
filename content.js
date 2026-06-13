// content.js — Auto Life Logger v2
// Handles: activity pings, intervention overlay, achievement toasts, strict-mode recheck
'use strict';

// ─── Activity Reporting ───────────────────────────────────────────────────────

let activityTimer = null;
function pingActivity() {
  clearTimeout(activityTimer);
  activityTimer = setTimeout(() =>
    chrome.runtime.sendMessage({ type: 'ACTIVITY_PING' }).catch(() => {}), 4000);
}
['mousemove','click','keydown','scroll','touchstart'].forEach(e =>
  document.addEventListener(e, pingActivity, { passive: true }));

// ─── Intervention Overlay ─────────────────────────────────────────────────────

const ICONS = { time: '⏱', loop: '🔁', rebound: '⚡', leak: '💧', default: '⚠️' };
const REASON_LABELS = {
  time:    'Time Limit Reached',
  loop:    'Distraction Loop',
  rebound: 'Focus Broken',
  leak:    'Micro-Distraction',
  default: 'Focus Alert'
};

let interventionEl = null;
let dismissTimer   = null;

function showIntervention({ domain, reason, message }) {
  if (!domain || !message) return;
  clearIntervention();
  ensureStyles();

  const icon  = ICONS[reason] || ICONS.default;
  const label = REASON_LABELS[reason] || REASON_LABELS.default;
  const safeMsg = escHtml(message)
    .replace(new RegExp(escRegex(domain), 'g'), `<strong>${escHtml(domain)}</strong>`);

  interventionEl = document.createElement('div');
  interventionEl.id = 'all-iv';
  interventionEl.innerHTML = `
    <div class="all-iv-inner">
      <div class="all-iv-icon">${icon}</div>
      <div class="all-iv-body">
        <div class="all-iv-label">${label}</div>
        <div class="all-iv-msg">${safeMsg}</div>
      </div>
      <button class="all-iv-close" aria-label="Dismiss">&#x2715;</button>
    </div>
    <div class="all-iv-progress"><div class="all-iv-bar" id="allBar"></div></div>
    <div class="all-iv-actions">
      <button class="all-iv-btn all-iv-focus" id="allFocus">Stay Focused</button>
      <button class="all-iv-btn all-iv-ignore" id="allIgnore">Ignore</button>
    </div>
    <div class="all-iv-footer">
      Auto Life Logger &nbsp;·&nbsp;
      <a href="#" id="allDash" class="all-iv-link">Open Dashboard</a>
    </div>`;

  document.documentElement.appendChild(interventionEl);

  // Animate progress bar over AUTO_DISMISS_MS
  const AUTO_DISMISS_MS = 14000;
  const bar = document.getElementById('allBar');
  if (bar) {
    bar.style.transition = 'none';
    bar.style.width = '100%';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bar.style.transition = `width ${AUTO_DISMISS_MS}ms linear`;
      bar.style.width = '0%';
    }));
  }

  dismissTimer = setTimeout(clearIntervention, AUTO_DISMISS_MS);

  const respond = (r) => {
    chrome.runtime.sendMessage({ type: 'INTERVENTION_RESPONSE', payload: { domain, reason, response: r } }).catch(() => {});
    clearIntervention();
  };

  interventionEl.querySelector('#allFocus').addEventListener('click', () => respond('focused'));
  interventionEl.querySelector('#allIgnore').addEventListener('click', () => respond('ignored'));
  interventionEl.querySelector('.all-iv-close').addEventListener('click', clearIntervention);
  interventionEl.querySelector('#allDash').addEventListener('click', e => {
    e.preventDefault();
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' }).catch(() => {});
    clearIntervention();
  });
}

function clearIntervention() {
  clearTimeout(dismissTimer);
  if (!interventionEl) return;
  interventionEl.classList.add('all-iv-out');
  setTimeout(() => { interventionEl?.remove(); interventionEl = null; }, 300);
}

// ─── Achievement Toast ────────────────────────────────────────────────────────

const toastQueue = [];
let toastActive  = false;

function queueAchievementToast(ach) {
  toastQueue.push(ach);
  if (!toastActive) showNextToast();
}

function showNextToast() {
  if (!toastQueue.length) { toastActive = false; return; }
  toastActive = true;
  const ach = toastQueue.shift();
  ensureStyles();

  const el = document.createElement('div');
  el.id        = 'all-ach';
  el.innerHTML = `
    <div class="all-ach-icon">${ach.icon || '🏆'}</div>
    <div class="all-ach-body">
      <div class="all-ach-sub">Achievement Unlocked</div>
      <div class="all-ach-title">${escHtml(ach.title)}</div>
      <div class="all-ach-desc">${escHtml(ach.desc)}</div>
    </div>`;
  document.documentElement.appendChild(el);

  setTimeout(() => el.classList.add('all-ach-out'), 3500);
  setTimeout(() => { el.remove(); showNextToast(); }, 3800);
}

// ─── Style Injection ──────────────────────────────────────────────────────────

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
/* ─ Intervention ─────────────────────────────────────────────────── */
#all-iv {
  position: fixed; top: 24px; right: 24px; z-index: 2147483647;
  width: 360px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: linear-gradient(155deg, #0e0e1e 0%, #161628 100%);
  border: 1px solid rgba(233,69,96,.45);
  border-radius: 16px; padding: 18px;
  box-shadow: 0 0 0 1px rgba(233,69,96,.08), 0 20px 60px rgba(0,0,0,.8), 0 4px 20px rgba(233,69,96,.18);
  animation: allIn .38s cubic-bezier(.34,1.56,.64,1) both;
  pointer-events: all;
}
#all-iv.all-iv-out { animation: allOut .28s ease-in both; }
@keyframes allIn  { from{transform:translateX(calc(100% + 32px));opacity:0} to{transform:translateX(0);opacity:1} }
@keyframes allOut { to{transform:translateX(calc(100% + 32px));opacity:0} }
#all-iv * { box-sizing:border-box; margin:0; padding:0; }
.all-iv-inner { display:flex; align-items:flex-start; gap:12px; margin-bottom:12px; }
.all-iv-icon  { font-size:26px; flex-shrink:0; width:40px; height:40px; background:rgba(233,69,96,.12); border-radius:10px; display:flex; align-items:center; justify-content:center; }
.all-iv-body  { flex:1; min-width:0; }
.all-iv-label { font-size:9.5px; font-weight:700; letter-spacing:1.1px; text-transform:uppercase; color:#ff6868; margin-bottom:4px; }
.all-iv-msg   { font-size:13.5px; line-height:1.55; color:#a8b4d0; }
.all-iv-msg strong { color:#e8eaf6; }
.all-iv-close { background:none; border:none; color:#3a3f5c; font-size:20px; cursor:pointer; flex-shrink:0; transition:color .15s; line-height:1; }
.all-iv-close:hover { color:#ff6868; }
.all-iv-progress { height:2px; background:rgba(255,255,255,.06); border-radius:2px; overflow:hidden; margin-bottom:12px; }
.all-iv-bar  { height:100%; background:linear-gradient(90deg,#ff6868,#ff9a8c); border-radius:2px; width:100%; }
.all-iv-actions { display:flex; gap:8px; margin-bottom:10px; }
.all-iv-btn  { flex:1; padding:9px; border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; border:none; font-family:inherit; transition:transform .1s,box-shadow .1s,opacity .1s; }
.all-iv-btn:active { transform:scale(.96); }
.all-iv-focus { background:linear-gradient(135deg,#6ecb93,#49a7a1); color:#07110d; box-shadow:0 4px 14px rgba(110,203,147,.24); }
.all-iv-focus:hover { box-shadow:0 6px 22px rgba(110,203,147,.38); }
.all-iv-ignore { background:rgba(255,255,255,.05); color:#6a7090; border:1px solid rgba(255,255,255,.08); }
.all-iv-ignore:hover { background:rgba(255,255,255,.09); color:#9196b0; }
.all-iv-footer { font-size:11px; color:#2e3450; text-align:center; }
.all-iv-link { color:#6ecb93; text-decoration:none; }
.all-iv-link:hover { text-decoration:underline; }

/* ─ Achievement Toast ──────────────────────────────────────────────── */
#all-ach {
  position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
  z-index:2147483647; display:flex; align-items:center; gap:14px;
  background:linear-gradient(135deg,#1a1a2e,#1e1e38);
  border:1px solid rgba(110,203,147,.35); border-radius:8px;
  padding:14px 20px; min-width:280px; max-width:400px;
  box-shadow:0 8px 40px rgba(0,0,0,.7), 0 0 0 1px rgba(110,203,147,.1), 0 4px 20px rgba(110,203,147,.14);
  animation:achIn .4s cubic-bezier(.34,1.56,.64,1) both;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  pointer-events:none;
}
#all-ach.all-ach-out { animation:achOut .3s ease-in both; }
@keyframes achIn  { from{transform:translateX(-50%) translateY(24px);opacity:0} to{transform:translateX(-50%) translateY(0);opacity:1} }
@keyframes achOut { to{transform:translateX(-50%) translateY(24px);opacity:0} }
#all-ach * { box-sizing:border-box; margin:0; padding:0; }
.all-ach-icon  { font-size:32px; flex-shrink:0; }
.all-ach-body  { flex:1; }
.all-ach-sub   { font-size:9px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:#6ecb93; margin-bottom:2px; }
.all-ach-title { font-size:14px; font-weight:700; color:#e8eaf6; margin-bottom:2px; }
.all-ach-desc  { font-size:12px; color:#8891b2; line-height:1.4; }
@media (max-width: 520px) {
  #all-iv {
    top: 12px;
    right: 12px;
    left: 12px;
    width: auto;
    padding: 14px;
  }
  .all-iv-actions {
    flex-direction: column;
  }
  #all-ach {
    left: 12px;
    right: 12px;
    bottom: 16px;
    min-width: 0;
    max-width: none;
    transform: none;
  }
  @keyframes achIn  { from{transform:translateY(24px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes achOut { to{transform:translateY(24px);opacity:0} }
}
`;
  document.documentElement.appendChild(s);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Message Listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (!msg || typeof msg !== 'object') return false;
  switch (msg.type) {
    case 'SHOW_INTERVENTION':
      showIntervention(msg.payload || {});
      reply({ ok: true });
      break;
    case 'ACHIEVEMENT_TOAST':
      queueAchievementToast(msg.payload);
      reply({ ok: true });
      break;
    case 'STRICT_BLOCK':
      // Background requested block — reload to trigger blocker.js
      location.reload();
      reply({ ok: true });
      break;
    default:
      break;
  }
  return false;
});
