// popup.js — Auto Life Logger v2
'use strict';

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmt(s) {
  if (s == null || isNaN(s) || s < 0) return '—';
  if (s < 60)  return `${Math.round(s)}s`;
  const m = Math.floor(s/60), sec = s%60;
  if (m < 60)  return sec ? `${m}m ${sec}s` : `${m}m`;
  const h = Math.floor(m/60), rm = m%60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

function scoreColor(n) {
  if (n == null) return 'var(--text-muted)';
  if (n >= 70)   return 'var(--success)';
  if (n >= 40)   return 'var(--warning)';
  return 'var(--danger)';
}

function scoreLabel(n) {
  if (n == null) return '';
  if (n >= 85)   return 'Excellent';
  if (n >= 70)   return 'Focused';
  if (n >= 50)   return 'Average';
  if (n >= 30)   return 'Distracted';
  return 'Off track';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

function domainInitial(domain) {
  return esc(String(domain || '?').replace(/^www\./, '').charAt(0).toUpperCase() || '?');
}

function domainIcon(domain, cls = 'domain-icon') {
  return `<span class="${cls}" aria-hidden="true">${domainInitial(domain)}</span>`;
}

function msg(type, payload) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type, payload }, r => {
      if (chrome.runtime.lastError || !r?.ok) {
        console.warn('[ALL] Message failed:', type, chrome.runtime.lastError?.message || r?.error);
        resolve(null);
        return;
      }
      resolve(r.data ?? null);
    });
  });
}

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  window.close();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderSession(d) {
  const dot  = document.getElementById('puDot');
  const text = document.getElementById('puSessionText');
  const sess = document.getElementById('puSession');

  if (d.currentDomain) {
    dot.style.display = 'block';
    dot.className = `pulse-dot ${d.currentIsDistraction ? 'pulse-dot-red' : 'pulse-dot-green'}`;
    text.textContent = d.currentDuration ? `${d.currentDomain} · ${fmt(d.currentDuration)}` : d.currentDomain;
    text.style.color  = d.currentIsDistraction ? 'var(--danger)' : 'var(--text-primary)';
  } else if (d.trackingPausedUntil && d.trackingPausedUntil > Date.now()) {
    dot.style.display = 'none';
    text.textContent  = `Paused until ${new Date(d.trackingPausedUntil).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}`;
    text.style.color  = 'var(--warning)';
  } else {
    dot.style.display = 'none';
    text.textContent  = 'No active session';
    text.style.color  = 'var(--text-muted)';
  }
  if (d.strictModeEnabled) {
    document.getElementById('strictBadge').style.display = 'inline';
  }
}

function renderHero(d) {
  const score   = d.disciplineScore;
  const streak  = d.streak;

  // Score
  const scoreEl = document.getElementById('puScore');
  scoreEl.textContent   = score ?? '—';
  scoreEl.style.color   = scoreColor(score);

  const fill = document.getElementById('puScoreFill');
  fill.style.width      = score ? `${score}%` : '0%';
  fill.style.background = scoreColor(score);

  // Streak
  document.getElementById('puStreak').textContent     = streak?.current ?? 0;
  document.getElementById('puStreakBest').textContent  =
    streak?.longest > 0 ? `Best: ${streak.longest}` : '';
}

function renderStats(d) {
  document.getElementById('psTotal').textContent      = fmt(d.total);
  document.getElementById('psDistract').textContent   = fmt(d.distract);
  document.getElementById('psProductive').textContent = fmt(d.productive);
  document.getElementById('psSites').textContent      = d.uniqueDomains ?? 0;
  document.getElementById('puSessCount').textContent  = `${d.totalSessions ?? 0} sessions`;
}

function renderSites(sites) {
  const el = document.getElementById('puSites');
  if (!sites?.length) {
    el.innerHTML = '<div class="empty-msg">No sites tracked yet today.</div>';
    return;
  }
  const max = Math.max(sites[0]?.duration || 0, 1);
  el.innerHTML = sites.map((s, i) => `
    <div class="pu-site-row" style="animation-delay:${i*35}ms">
      ${domainIcon(s.domain, 'pu-favicon domain-icon')}
      <span class="pu-site-name">${esc(s.domain)}</span>
      <div class="pu-site-bar">
        <div class="pu-site-fill ${s.isDistraction ? 'fill-danger' : s.isProductive ? 'fill-success' : 'fill-accent'}"
             style="width:${Math.round((s.duration/max)*100)}%"></div>
      </div>
      <span class="pu-site-dur">${fmt(s.duration)}</span>
    </div>`).join('');
}

function renderAlerts(alerts) {
  const wrap  = document.getElementById('puAlerts');
  const list  = document.getElementById('puAlertList');
  const badge = document.getElementById('puAlertBadge');
  if (!alerts?.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  badge.textContent  = alerts.length;
  list.innerHTML     = alerts.map(a => `
    <div class="pu-alert-pill">
      <span>🔁</span>
      <span><strong>${esc(a.domain)}</strong> visited ${Number(a.count) || 0}× recently</span>
    </div>`).join('');
}

function renderAchievements(achs) {
  const sec  = document.getElementById('puAchSection');
  const list = document.getElementById('puAchList');
  if (!achs?.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  list.innerHTML = achs.map(a => `
    <div class="pu-ach-badge" title="${esc(a.desc)}">
      <span class="pu-ach-icon">${esc(a.icon)}</span>
      <span class="pu-ach-name">${esc(a.title)}</span>
    </div>`).join('');
}

// ─── Summary Popover ─────────────────────────────────────────────────────────

async function showSummary() {
  const s = await msg('GENERATE_SUMMARY', {});
  if (!s) { alert('No data yet for today.'); return; }
  const lines = [
    `Daily Summary — ${s.date}`,
    `─────────────────────────`,
    `Total time:       ${fmt(s.total)}`,
    `Productive:       ${fmt(s.productive)}`,
    `Distraction:      ${fmt(s.distract)}`,
    `Discipline score: ${s.disciplineScore ?? '—'}/100`,
    `Streak:           ${s.streak} day${s.streak !== 1 ? 's' : ''}`,
    ``,
    `💡 ${s.insight}`
  ];
  alert(lines.join('\n'));
}

// ─── Load ─────────────────────────────────────────────────────────────────────

async function load() {
  const data = await msg('GET_TODAY_STATS');
  if (!data) return;
  renderSession(data);
  renderHero(data);
  renderStats(data);
  renderSites(data.topSites);
  renderAlerts(data.loopAlerts);
  renderAchievements(data.recentAchievements);
}

// ─── Events ───────────────────────────────────────────────────────────────────

document.getElementById('btnDash').addEventListener('click', openDashboard);
document.getElementById('btnDash2').addEventListener('click', openDashboard);
document.getElementById('btnSummary').addEventListener('click', showSummary);

load();
