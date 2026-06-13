// dashboard.js — Auto Life Logger v2 full analytics dashboard
'use strict';

// ─── Utilities ────────────────────────────────────────────────────────────────

const fmt = s => {
  if (s == null || isNaN(s) || s < 0) return '0s';
  if (s < 60)  return `${Math.round(s)}s`;
  const m = Math.floor(s/60), sec = s%60;
  if (m < 60)  return sec ? `${m}m ${sec}s` : `${m}m`;
  const h = Math.floor(m/60), rm = m%60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
};

const fmtDate = dk => {
  const [y,m,d] = dk.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
};

function getDateKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addDays(dk, n) {
  const [y,m,d] = dk.split('-').map(Number);
  return getDateKey(new Date(y,m-1,d+n).getTime());
}

const scoreColor = n => n == null ? '#657568' : n >= 70 ? '#7ad08f' : n >= 40 ? '#efb75a' : '#ff6868';
const scoreLabel = n => n == null ? '—' : n >= 85 ? 'Excellent' : n >= 70 ? 'Focused' : n >= 50 ? 'Average' : n >= 30 ? 'Distracted' : 'Off Track';

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

function toDatetimeLocal(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value) {
  return value ? new Date(value).getTime() : 0;
}

function thresholdsToText(map) {
  return Object.entries(map || {}).map(([domain, threshold]) => `${domain}, ${threshold}`).join('\n');
}

function textToThresholds(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const [domainRaw, value] = line.split(',').map(s => s?.trim());
    const domain = normalizeDomain(domainRaw);
    const n = Number(value);
    if (domain && Number.isFinite(n)) out[domain.toLowerCase()] = Math.max(1, Math.round(n));
  }
  return out;
}

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .replace(/,+$/, '');
}

function readDomainLines(id) {
  const seen = new Set();
  return document.getElementById(id).value
    .split('\n')
    .map(normalizeDomain)
    .filter(domain => {
      if (!domain || seen.has(domain)) return false;
      seen.add(domain);
      return true;
    });
}

function readNumber(id, fallback, min, max) {
  const n = Number(document.getElementById(id).value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// ─── Canvas Chart Engine ──────────────────────────────────────────────────────

const C = {
  accent:  '#6ecb93', accent2: '#49a7a1',
  danger:  '#ff6868', success:  '#7ad08f',
  warning: '#efb75a', muted:    '#26342b',
  text:    '#a8b8aa', grid:     'rgba(223,239,224,0.05)',
  overlay: '#101611'
};

function prep(id, h) {
  const el = document.getElementById(id);
  if (!el) return null;
  const ctx = el.getContext('2d');
  el.width  = el.parentElement.clientWidth || 400;
  el.height = h || parseInt(el.getAttribute('height')) || 200;
  ctx.clearRect(0, 0, el.width, el.height);
  return { ctx, W: el.width, H: el.height };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

function drawEmpty(ctx, W, H) {
  ctx.fillStyle = '#2e3450';
  ctx.font = '13px -apple-system, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('No data', W/2, H/2);
}

// Horizontal bar chart
function hBarChart(id, items) {
  const p = prep(id, null); if (!p) return;
  const { ctx, W, H } = p;
  if (!items.length) { drawEmpty(ctx, W, H); return; }
  const N = Math.min(items.length, 10);
  const padL=8, padR=58, padT=8, padB=8;
  const rowH = (H-padT-padB) / N;
  const barH = Math.min(rowH*0.5, 18);
  const aW   = W - padL - padR;

  for (let i = 0; i < N; i++) {
    const it   = items[i];
    const y    = padT + i*rowH + rowH/2;
    const pct  = items[0].value > 0 ? it.value / items[0].value : 0;
    const bW   = Math.max(pct * aW, 1);

    // Track
    ctx.fillStyle = C.muted;
    rr(ctx, padL, y-barH/2, aW, barH, 3); ctx.fill();

    // Fill
    const g = ctx.createLinearGradient(padL, 0, padL+bW, 0);
    if (it.isDistraction) { g.addColorStop(0,'#ff6868'); g.addColorStop(1,'#ff9a8c'); }
    else if (it.isProductive) { g.addColorStop(0,'#6ecb93'); g.addColorStop(1,'#8ee6a9'); }
    else { g.addColorStop(0,'#6ecb93'); g.addColorStop(1,'#49a7a1'); }
    ctx.fillStyle = g;
    rr(ctx, padL, y-barH/2, bW, barH, 3); ctx.fill();

    // Label
    ctx.fillStyle = C.text; ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(it.label.length > 24 ? it.label.slice(0,22)+'…' : it.label, padL, y-barH/2-3);

    // Value
    ctx.fillStyle = '#e8eaf6'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(it.val, padL+aW+6, y);
  }
}

// Donut chart
function donutChart(id, segs) {
  const p = prep(id, null); if (!p) return;
  const { ctx, W, H } = p;
  const total = segs.reduce((a,s) => a+s.v, 0);
  if (!total) { drawEmpty(ctx, W, H); return; }

  const cx=W/2, cy=H/2, r=Math.min(cx,cy)-22, ri=r*0.58;
  let ang = -Math.PI/2;
  for (const seg of segs) {
    const arc = (seg.v/total)*2*Math.PI;
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.arc(cx, cy, r, ang, ang+arc);
    ctx.closePath(); ctx.fillStyle = seg.color; ctx.fill();
    ang += arc;
  }
  // Hole
  ctx.beginPath(); ctx.arc(cx,cy,ri,0,2*Math.PI);
  ctx.fillStyle = C.overlay; ctx.fill();
  // Center
  ctx.fillStyle = '#e8eaf6'; ctx.font = 'bold 16px -apple-system,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(fmt(total), cx, cy-7);
  ctx.fillStyle = C.text; ctx.font = '10px -apple-system,sans-serif';
  ctx.fillText('total', cx, cy+10);
  // Legend
  let ly = H - segs.length*19 - 4;
  for (const seg of segs) {
    ctx.fillStyle = seg.color; ctx.fillRect(12, ly, 9, 9);
    ctx.fillStyle = C.text; ctx.font = '11px -apple-system,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`${seg.label} (${fmt(seg.v)})`, 24, ly);
    ly += 19;
  }
}

// Vertical bar chart
function vBarChart(id, items, maxVal, yLabelFn) {
  const p = prep(id, null); if (!p) return;
  const { ctx, W, H } = p;
  const N = items.length; if (!N) { drawEmpty(ctx,W,H); return; }
  const padL=32, padR=10, padT=18, padB=32;
  const mx   = maxVal || Math.max(...items.map(x=>x.v), 1);
  const aW   = W-padL-padR, aH = H-padT-padB;
  const gap  = aW/N, bW = Math.max(4, gap*0.6);

  [0,0.25,0.5,0.75,1].forEach(pct => {
    const y = padT+aH*(1-pct);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(W-padR,y); ctx.stroke();
    if (yLabelFn) {
      ctx.fillStyle = C.text; ctx.font = '9px -apple-system,sans-serif';
      ctx.textAlign = 'right'; ctx.fillText(yLabelFn(mx*pct), padL-3, y+3);
    }
  });

  for (let i = 0; i < N; i++) {
    const it  = items[i];
    const x   = padL + i*gap + gap/2 - bW/2;
    const pct = it.v / mx;
    const bH  = Math.max(2, pct*aH);
    const y   = padT+aH-bH;
    const g   = ctx.createLinearGradient(0,y,0,y+bH);
    const col = it.color || C.accent;
    g.addColorStop(0, col); g.addColorStop(1, col+'66');
    ctx.fillStyle = g; rr(ctx, x, y, bW, bH, 3); ctx.fill();
    // X label
    ctx.fillStyle = C.text; ctx.font = '9px -apple-system,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(it.lbl||'', padL+i*gap+gap/2, padT+aH+5);
    // Value label
    if (it.vlbl) {
      ctx.fillStyle = '#e8eaf6'; ctx.font = '9px -apple-system,sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText(it.vlbl, padL+i*gap+gap/2, y-2);
    }
  }
}

// Context bar chart (horizontal stacked)
function contextChart(id, data) {
  const p = prep(id, null); if (!p) return;
  const { ctx, W, H } = p;
  const total = Object.values(data).reduce((a,v)=>a+v,0);
  if (!total) { drawEmpty(ctx,W,H); return; }

  const COLORS = { coding:'#49a7a1', docs:'#6ecb93', productivity:'#7ad08f',
                   learning:'#efb75a', entertainment:'#ff6868', social:'#ff9a8c', other:'#405143' };
  const LABELS = { coding:'Coding', docs:'Docs/Research', productivity:'Productivity',
                   learning:'Learning', entertainment:'Entertainment', social:'Social', other:'Other' };

  const padH = 28, barH = 22;
  const aW   = W - 24;
  let x = 12;
  const sortedKeys = Object.keys(data).sort((a,b) => data[b]-data[a]);

  // Draw bar
  for (const key of sortedKeys) {
    const v = data[key]; if (!v) continue;
    const bW = (v/total)*aW;
    ctx.fillStyle = COLORS[key] || '#3a3f5c';
    rr(ctx, x, padH, bW, barH, 3); ctx.fill();
    if (bW > 30) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 10px -apple-system,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(Math.round((v/total)*100)+'%', x+bW/2, padH+barH/2);
    }
    x += bW;
  }

  // Legend
  let lx = 12, ly = padH + barH + 10;
  for (const key of sortedKeys) {
    const v = data[key]; if (!v) continue;
    ctx.fillStyle = COLORS[key]||'#3a3f5c'; ctx.fillRect(lx, ly, 8, 8);
    ctx.fillStyle = C.text; ctx.font = '10px -apple-system,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const label = `${LABELS[key]||key} (${fmt(v)})`;
    ctx.fillText(label, lx+11, ly);
    lx += ctx.measureText(label).width + 24;
    if (lx > W - 100) { lx = 12; ly += 16; }
  }
}

// Pattern stacked bar
function patternChart(id, days) {
  const p = prep(id, null); if (!p) return;
  const { ctx, W, H } = p;
  const N = days.length; if (!N) { drawEmpty(ctx,W,H); return; }
  const COLORS = { TIME_OVERRUN:'#efb75a', DISTRACT_LOOP:'#ff6868', SOCIAL_REBOUND:'#49a7a1', TIME_LEAK:'#bd8bff' };
  const TYPES  = Object.keys(COLORS);
  const mx     = Math.max(...days.map(d => d.total), 1);
  const padL=20, padR=10, padT=18, padB=30;
  const aW = W-padL-padR, aH = H-padT-padB;
  const gap = aW/N, bW = Math.max(6, gap*0.55);

  [0,0.5,1].forEach(pct => {
    const y = padT+aH*(1-pct);
    ctx.strokeStyle = C.grid; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(W-padR,y); ctx.stroke();
    ctx.fillStyle=C.text; ctx.font='9px -apple-system,sans-serif';
    ctx.textAlign='right'; ctx.fillText(Math.round(mx*pct), padL-3, y+3);
  });

  for (let i=0; i<N; i++) {
    const d  = days[i];
    const x  = padL+i*gap+gap/2-bW/2;
    let   yy = padT+aH;
    for (const type of TYPES) {
      const v = d[type]||0; if (!v) continue;
      const bH = (v/mx)*aH;
      yy -= bH;
      ctx.fillStyle = COLORS[type]; rr(ctx,x,yy,bW,bH,2); ctx.fill();
    }
    ctx.fillStyle=C.text; ctx.font='9px -apple-system,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(d.lbl, padL+i*gap+gap/2, padT+aH+4);
  }

  // Legend
  let lx=W-TYPES.length*80; const ly=4;
  for (const type of TYPES) {
    ctx.fillStyle=COLORS[type]; ctx.fillRect(lx,ly,7,7);
    ctx.fillStyle=C.text; ctx.font='9px -apple-system,sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='top';
    const short={TIME_OVERRUN:'Time',DISTRACT_LOOP:'Loop',SOCIAL_REBOUND:'Rebound',TIME_LEAK:'Leak'};
    ctx.fillText(short[type]||type, lx+9, ly);
    lx += 72;
  }
}

// ─── State ────────────────────────────────────────────────────────────────────

let currentDk  = getDateKey();
let allSessions    = [];
let allPatterns    = [];
let allSummaries   = {};
let allScores      = {};
let settings       = {};
let gamification   = { streak: { current:0, longest:0 }, achievements: [], totalFocusedResponses: 0 };
let interventionLog= [];
let currentPage    = 'overview';

// ─── Data Aggregation ─────────────────────────────────────────────────────────

function agg(sessions) {
  const dm = {}; let total=0, distract=0, productive=0;
  for (const s of sessions) {
    if (!dm[s.domain]) dm[s.domain]={ domain:s.domain, duration:0, visits:0, isDistraction:s.isDistraction, isProductive:s.isProductive };
    dm[s.domain].duration += s.duration; dm[s.domain].visits++;
    total += s.duration;
    if (s.isDistraction) distract  += s.duration;
    if (s.isProductive)  productive += s.duration;
  }
  return { total, distract, productive, neutral: total-distract-productive,
           sites: Object.values(dm).sort((a,b)=>b.duration-a.duration),
           uniqueDomains: Object.keys(dm).length, sessions: sessions.length };
}

function hourlyData(sessions) {
  const h = new Array(24).fill(0);
  for (const s of sessions) if (s.hour>=0&&s.hour<24) h[s.hour]+=s.duration;
  return h;
}

function contextData(sessions) {
  const c = {};
  for (const s of sessions) c[s.context||'other'] = (c[s.context||'other']||0) + s.duration;
  return c;
}

// ─── Page Renderers ───────────────────────────────────────────────────────────

function renderOverview() {
  const sessions = allSessions.filter(s => s.date === currentDk);
  const a = agg(sessions);
  const score   = allScores[currentDk];
  const summary = allSummaries[currentDk];

  // Metrics
  document.getElementById('mvTotal').textContent   = fmt(a.total);
  document.getElementById('mvProd').textContent    = fmt(a.productive);
  document.getElementById('mvDistract').textContent= fmt(a.distract);
  document.getElementById('mvSites').textContent   = a.uniqueDomains;
  document.getElementById('mvSess').textContent    = a.sessions;
  const scoreEl = document.getElementById('mvScore');
  scoreEl.textContent = score?.score ?? '—';
  scoreEl.style.color = scoreColor(score?.score);

  // Date label
  const today = getDateKey();
  const lbl = currentDk === today ? 'Today' : currentDk === addDays(today,-1) ? 'Yesterday' : fmtDate(currentDk);
  document.getElementById('dateLabel').textContent = lbl;
  document.getElementById('ovDate').textContent    = fmtDate(currentDk);
  document.getElementById('dateNext').disabled     = currentDk >= today;

  // Charts
  hBarChart('cSites', a.sites.slice(0,8).map(s => ({ label:s.domain, v:s.duration, value:s.duration, val:fmt(s.duration), isDistraction:s.isDistraction, isProductive:s.isProductive })));
  donutChart('cDonut', [
    ...(a.productive>0 ? [{ label:'Productive',  v:a.productive, color:'#7ad08f' }] : []),
    ...(a.distract>0   ? [{ label:'Distraction', v:a.distract,   color:'#ff6868' }] : []),
    ...(a.neutral>0    ? [{ label:'Neutral',      v:a.neutral,    color:'#2a2a42' }] : [])
  ]);

  // Heatmap
  const hours = hourlyData(sessions);
  const maxH  = Math.max(...hours, 1);
  const hm    = document.getElementById('heatmap');
  const hl    = document.getElementById('heatmapLbl');
  hm.innerHTML = hl.innerHTML = '';
  for (let h=0; h<24; h++) {
    const cell = document.createElement('div');
    cell.className = 'hm-cell';
    cell.title = `${h}:00 — ${fmt(hours[h])}`;
    const alpha = hours[h] > 0 ? 0.08 + (hours[h]/maxH)*0.92 : 0;
    cell.style.background = alpha > 0 ? `rgba(110,203,147,${alpha.toFixed(2)})` : 'rgba(38,52,43,0.72)';
    hm.appendChild(cell);
    const lb = document.createElement('div');
    lb.className = 'hm-label';
    lb.textContent = h%4===0 ? `${h}h` : '';
    hl.appendChild(lb);
  }

  // Context chart
  const ctx = contextData(sessions);
  contextChart('cContext', ctx);

  // Weekly trend
  const weekDays = Array.from({length:7},(_,i)=>addDays(getDateKey(),-6+i));
  const trend = document.getElementById('weeklyTrend');
  const weekAgg = weekDays.map(dk => ({ dk, ...agg(allSessions.filter(s => s.date === dk)) }));
  const maxTotal = Math.max(...weekAgg.map(d => d.total), 1);
  trend.innerHTML = weekAgg.map(d => {
    const prodPct = d.total ? Math.round((d.productive / d.total) * 100) : 0;
    const disPct = d.total ? Math.round((d.distract / d.total) * 100) : 0;
    const height = Math.max(4, Math.round((d.total / maxTotal) * 100));
    return `<div class="week-day" title="${fmtDate(d.dk)} · ${fmt(d.total)} total">
      <div class="week-bars" style="height:${height}%">
        <div class="week-prod" style="height:${prodPct}%"></div>
        <div class="week-dis" style="height:${disPct}%"></div>
      </div>
      <div class="week-label">${d.dk.slice(5)}</div>
    </div>`;
  }).join('');

  // Insight
  const ib  = document.getElementById('ovInsight');
  const it  = document.getElementById('ovInsightText');
  if (summary?.insight) { ib.style.display='block'; it.textContent = summary.insight; }
  else { ib.style.display='none'; }
}

function renderSites() {
  const sessions = allSessions.filter(s => s.date === currentDk);
  const a  = agg(sessions);
  const el = document.getElementById('sitesTable');
  if (!a.sites.length) { el.innerHTML='<div class="empty-msg" style="padding:40px">No sites tracked.</div>'; return; }
  const max = Math.max(a.sites[0].duration, 1);
  el.innerHTML = a.sites.map((s,i) => `
    <div class="dt-row" style="animation-delay:${i*20}ms">
      ${domainIcon(s.domain, 'dt-fav domain-icon')}
      <span class="dt-name">${esc(s.domain)}</span>
      <span class="badge ${s.isDistraction?'badge-danger':s.isProductive?'badge-success':'badge-accent'}">${s.isDistraction?'distraction':s.isProductive?'productive':'neutral'}</span>
      <div style="width:130px"><div class="progress-track" style="height:4px"><div class="progress-fill ${s.isDistraction?'fill-danger':s.isProductive?'fill-success':'fill-accent'}" style="width:${Math.round((s.duration/max)*100)}%"></div></div></div>
      <span class="dt-dur">${fmt(s.duration)}</span>
      <span class="dt-visits">${s.visits} visit${s.visits!==1?'s':''}</span>
    </div>`).join('');
}

function renderPatterns() {
  const today = getDateKey();
  const w7start = addDays(today, -6);
  const recent  = allPatterns.filter(p => p.date >= w7start).slice(-60).reverse();
  const ICONS   = { TIME_OVERRUN:'⏱', DISTRACT_LOOP:'🔁', SOCIAL_REBOUND:'⚡', TIME_LEAK:'💧' };
  const NAMES   = { TIME_OVERRUN:'Time Overrun', DISTRACT_LOOP:'Distraction Loop', SOCIAL_REBOUND:'Social Rebound', TIME_LEAK:'Micro-Leak' };
  const COLORS  = { TIME_OVERRUN:'var(--warning)', DISTRACT_LOOP:'var(--danger)', SOCIAL_REBOUND:'var(--accent-2)', TIME_LEAK:'#9b59b6' };

  const pl = document.getElementById('patternList');
  pl.innerHTML = !recent.length
    ? '<div class="empty-msg" style="padding:24px">No patterns in the last 7 days.</div>'
    : recent.map((p,i) => {
        const detail = p.type==='TIME_OVERRUN'   ? `${p.minutes ?? '?'} min on ${p.domain}`
                     : p.type==='DISTRACT_LOOP'  ? `${p.count ?? '?'} visits to ${p.domain}`
                     : p.type==='SOCIAL_REBOUND' ? `${p.from} → ${p.to}`
                     : p.type==='TIME_LEAK'      ? `${p.count ?? '?'} quick visits to ${p.domain}`
                     : JSON.stringify(p);
        const time = p.ts ? new Date(p.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '';
        return `<div class="pt-item" style="animation-delay:${i*18}ms">
          <div class="pt-icon" style="color:${COLORS[p.type]||'var(--text-secondary)'}">${ICONS[p.type]||'⚠️'}</div>
          <div>
            <div class="pt-title" style="color:${COLORS[p.type]||'var(--text-primary)'}">${esc(NAMES[p.type]||p.type)}</div>
            <div class="pt-detail">${esc(detail)}</div>
            <div class="pt-time">${p.date} ${time}</div>
          </div>
        </div>`;
      }).join('');

  // Bar chart
  const week = Array.from({length:7},(_,i)=>addDays(today,-6+i));
  const chartData = week.map(dk => {
    const dp = allPatterns.filter(p => p.date === dk);
    return { lbl: dk.slice(5), total: dp.length,
      TIME_OVERRUN:  dp.filter(p=>p.type==='TIME_OVERRUN').length,
      DISTRACT_LOOP: dp.filter(p=>p.type==='DISTRACT_LOOP').length,
      SOCIAL_REBOUND:dp.filter(p=>p.type==='SOCIAL_REBOUND').length,
      TIME_LEAK:     dp.filter(p=>p.type==='TIME_LEAK').length };
  });
  patternChart('cPatterns', chartData);

  // Intervention stats
  const focused = interventionLog.filter(r=>r.response==='focused').length;
  const ignored = interventionLog.filter(r=>r.response==='ignored').length;
  const total   = focused + ignored;
  const ivEl    = document.getElementById('ivStats');
  if (!total) { ivEl.innerHTML='<div class="empty-msg" style="padding:20px">No intervention responses logged yet.</div>'; return; }
  const pct = Math.round((focused/total)*100);
  ivEl.innerHTML = `
    <div style="display:flex;gap:28px;align-items:center;padding:10px 0 16px">
      <div style="text-align:center"><div style="font-size:32px;font-weight:800;color:var(--success)">${focused}</div><div style="font-size:11px;color:var(--text-secondary)">Stayed Focused</div></div>
      <div style="text-align:center"><div style="font-size:32px;font-weight:800;color:var(--danger)">${ignored}</div><div style="font-size:11px;color:var(--text-secondary)">Ignored</div></div>
      <div style="flex:1">
        <div class="progress-track" style="height:8px"><div class="progress-fill fill-success" style="width:${pct}%;transition:width .6s cubic-bezier(.34,1.56,.64,1)"></div></div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:5px">${pct}% compliance rate — ${pct>=70?'👍 Good discipline!':'Keep choosing "Stay Focused" to improve your score.'}</div>
      </div>
    </div>`;
}

function renderScore() {
  const score = allScores[getDateKey()];
  const big   = document.getElementById('scoreBig');
  const grade = document.getElementById('scoreGrade');

  if (score?.score != null) {
    big.textContent    = score.score;
    big.style.color    = scoreColor(score.score);
    grade.textContent  = scoreLabel(score.score);
    grade.style.color  = scoreColor(score.score);
  } else {
    big.textContent  = '—'; grade.textContent = 'No data yet';
  }

  const c = score?.components || {};
  const COMP = [
    { key:'prodPts',  label:'Productive time',   max:40, color:'#7ad08f' },
    { key:'disPts',   label:'Low distraction',    max:30, color:'#49a7a1' },
    { key:'loopPts',  label:'No loops',           max:20, color:'#efb75a' },
    { key:'respPts',  label:'Intervention rate',  max:10, color:'#6ecb93' }
  ];
  document.getElementById('scoreComponents').innerHTML = COMP.map(x => `
    <div class="comp-bar">
      <span class="comp-label">${x.label}</span>
      <div class="progress-track" style="flex:1;height:5px"><div class="progress-fill" style="width:${Math.round(((c[x.key]||0)/x.max)*100)}%;background:${x.color};transition:width .6s cubic-bezier(.34,1.56,.64,1)"></div></div>
      <span class="comp-pts">${c[x.key]??0}/${x.max}</span>
    </div>`).join('');

  // History chart
  const today  = getDateKey();
  const days14 = Array.from({length:14},(_,i)=>addDays(today,-13+i));
  vBarChart('cScore', days14.map(dk=>({
    lbl:  dk.slice(5),
    v:    allScores[dk]?.score ?? 0,
    vlbl: allScores[dk]?.score != null ? String(allScores[dk].score) : '',
    color: scoreColor(allScores[dk]?.score)
  })), 100, v => Math.round(v));
}

function renderGamify() {
  const G = gamification;
  const streak = G.streak || { current:0, longest:0 };
  document.getElementById('gStreak').textContent    = streak.current;
  document.getElementById('gStreakBest').textContent = streak.longest > 0 ? `Best: ${streak.longest} days` : '';

  // History chart with score + threshold line
  const today  = getDateKey();
  const days14 = Array.from({length:14},(_,i)=>addDays(today,-13+i));
  const items  = days14.map(dk=>({
    lbl:   dk.slice(5),
    v:     allScores[dk]?.score ?? 0,
    vlbl:  allScores[dk]?.score != null ? String(allScores[dk].score) : '',
    color: scoreColor(allScores[dk]?.score)
  }));
  vBarChart('cStreakHistory', items, 100, v => Math.round(v));

  // Achievement grid
  const allDefs  = [
    { id:'first_session',   title:'First Steps',      desc:'Logged your first session',              icon:'🎯' },
    { id:'focus_60',        title:'Deep Focus',        desc:'60+ productive min in a day',            icon:'⚡' },
    { id:'clean_day',       title:'Crystal Clear',     desc:'Zero distraction for a full day',        icon:'💎' },
    { id:'streak_3',        title:'Hot Streak',        desc:'3 consecutive good days',                icon:'🔥' },
    { id:'streak_7',        title:'Weekly Warrior',    desc:'7 consecutive good days',                icon:'💪' },
    { id:'streak_30',       title:'Iron Will',         desc:'30 consecutive good days',               icon:'⚔️'  },
    { id:'perfect_score',   title:'Perfect Day',       desc:'Score of 100',                           icon:'⭐' },
    { id:'score_80',        title:'Laser Focus',       desc:'Score of 80+',                           icon:'🎖️' },
    { id:'stay_focused_10', title:'Iron Mind',         desc:'"Stay Focused" 10 times',                icon:'🧠' },
    { id:'early_bird',      title:'Early Bird',        desc:'Productive before 8 AM',                 icon:'🌅' },
    { id:'comeback',        title:'Comeback Kid',      desc:'Back after 3+ days, scored ≥70',         icon:'🔄', secret:true },
    { id:'strict_survived', title:'Locked In',         desc:'Strict Mode on all day',                 icon:'🔒', secret:true }
  ];
  const unlocked = new Set(G.achievements.map(a => a.id));
  document.getElementById('gAchCount').textContent = `${unlocked.size}/${allDefs.filter(d=>!d.secret).length} unlocked`;
  document.getElementById('achGrid').innerHTML = allDefs.map(def => {
    const got  = unlocked.has(def.id);
    const info = G.achievements.find(a => a.id === def.id);
    const dateStr = info?.unlockedAt ? new Date(info.unlockedAt).toLocaleDateString() : '';
    if (def.secret && !got) return '';
    return `<div class="ach-card ${got ? 'ach-unlocked' : 'ach-locked'}" title="${esc(def.desc)}${dateStr ? `\nUnlocked: ${esc(dateStr)}` : ''}">
      <div class="ach-icon">${got ? esc(def.icon) : '🔒'}</div>
      <div class="ach-title">${esc(def.title)}</div>
      <div class="ach-desc">${esc(def.desc)}</div>
      ${dateStr ? `<div class="ach-date">${dateStr}</div>` : ''}
    </div>`;
  }).join('');
}

function renderSummary() {
  const el   = document.getElementById('summaryList');
  const keys = Object.keys(allSummaries).sort().reverse();
  if (!keys.length) { el.innerHTML='<div class="empty-msg" style="padding:60px">No reports yet.</div>'; return; }

  el.innerHTML = keys.map(dk => {
    const s  = allSummaries[dk];
    const sc = allScores[dk];
    const pct = s.total > 0 ? Math.round((s.distract/s.total)*100) : 0;
    return `<div class="panel" style="margin-bottom:14px">
      <div class="panel-hd" style="margin-bottom:12px">
        ${fmtDate(dk)}
        <span style="margin-left:auto;font-size:13px;font-weight:700;color:${scoreColor(sc?.score)}">${sc?.score ?? '—'}/100</span>
        ${s.streak > 1 ? `<span class="badge badge-warning" style="margin-left:8px">🔥 ${s.streak}-day streak</span>` : ''}
      </div>
      <div class="rpt-stats">
        <div class="rs"><div class="rs-v">${fmt(s.total)}</div><div class="rs-l">Total</div></div>
        <div class="rs"><div class="rs-v" style="color:var(--success)">${fmt(s.productive)}</div><div class="rs-l">Productive</div></div>
        <div class="rs"><div class="rs-v" style="color:var(--danger)">${fmt(s.distract)}</div><div class="rs-l">Distraction</div></div>
        <div class="rs"><div class="rs-v">${s.uniqueDomains}</div><div class="rs-l">Sites</div></div>
        <div class="rs"><div class="rs-v" style="color:var(--warning)">${s.patternCount}</div><div class="rs-l">Patterns</div></div>
      </div>
      <div class="progress-track" style="margin:10px 0 14px"><div class="progress-fill fill-danger" style="width:${pct}%"></div></div>
      <div class="insight-box">${esc(s.insight || 'No insight.')}</div>
      ${s.topSites?.length ? `
        <div class="section-label" style="margin-top:14px;margin-bottom:8px">Top Sites</div>
        ${s.topSites.slice(0,5).map(site=>`
          <div class="dt-row" style="padding:6px 0">
            ${domainIcon(site.domain, 'dt-fav domain-icon domain-icon-sm')}
            <span class="dt-name">${esc(site.domain)}</span>
            <span class="dt-dur">${fmt(site.duration)}</span>
          </div>`).join('')}` : ''}
    </div>`;
  }).join('');
}

function renderHistory() {
  const today  = getDateKey();
  const days14 = Array.from({length:14},(_,i)=>addDays(today,-13+i));
  const byDay  = {};
  for (const s of allSessions) {
    if (!byDay[s.date]) byDay[s.date]={ total:0, distract:0, productive:0, sites:new Set() };
    byDay[s.date].total += s.duration; byDay[s.date].sites.add(s.domain);
    if (s.isDistraction) byDay[s.date].distract  += s.duration;
    if (s.isProductive)  byDay[s.date].productive += s.duration;
  }

  vBarChart('cHistory', days14.map(dk=>({
    lbl:   dk.slice(5),
    v:     byDay[dk]?.total || 0,
    vlbl:  byDay[dk]?.total ? fmt(byDay[dk].total) : '',
    color: '#6ecb93'
  })), null, fmt);

  const histEl = document.getElementById('historyList');
  const active = days14.filter(dk=>byDay[dk]).reverse();
  if (!active.length) { histEl.innerHTML='<div class="empty-msg" style="padding:40px">No history.</div>'; return; }

  histEl.innerHTML = active.map(dk => {
    const d  = byDay[dk];
    const sc = allScores[dk];
    const pct = d.total > 0 ? Math.round((d.distract/d.total)*100) : 0;
    return `<div class="panel card-hover" style="margin-bottom:10px;cursor:pointer" data-date="${dk}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="font-size:14px;font-weight:600">${fmtDate(dk)}</div>
        ${sc ? `<span style="font-size:14px;font-weight:700;color:${scoreColor(sc.score)}">${sc.score}/100</span>` : ''}
      </div>
      <div style="display:flex;gap:18px;font-size:12px;color:var(--text-secondary);margin-bottom:8px">
        <span>⏱ ${fmt(d.total)}</span>
        <span style="color:var(--success)">⚡ ${fmt(d.productive)}</span>
        <span style="color:var(--danger)">🎮 ${fmt(d.distract)}</span>
        <span>🌐 ${d.sites.size} sites</span>
      </div>
      <div class="progress-track" style="height:4px"><div class="progress-fill fill-danger" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');

  histEl.querySelectorAll('[data-date]').forEach(el =>
    el.addEventListener('click', () => { currentDk = el.dataset.date; navigate('overview'); })
  );
}

function renderSettings() {
  const s = settings;
  document.getElementById('sNotif').checked   = s.notificationsEnabled ?? true;
  document.getElementById('sInterv').checked  = s.interventionEnabled  ?? true;
  document.getElementById('sDaily').checked   = s.dailySummaryEnabled  ?? true;
  document.getElementById('sThresh').value    = s.warningThresholdMins ?? 30;
  document.getElementById('sLoopV').value     = s.loopDetectionVisits  ?? 4;
  document.getElementById('sLoopW').value     = s.loopDetectionWindowMins ?? 15;
  document.getElementById('sRetention').value = s.dataRetentionDays ?? 90;
  document.getElementById('sPauseUntil').value = toDatetimeLocal(s.trackingPausedUntil);
  document.getElementById('sNeverTrack').value = (s.neverTrackDomains || []).join('\n');
  document.getElementById('sDisSites').value  = (s.distractionSites||[]).join('\n');
  document.getElementById('sProdSites').value = (s.productiveSites||[]).join('\n');
  // Strict mode
  const sm = s.strictMode || {};
  document.getElementById('sStrict').checked       = sm.enabled       ?? false;
  document.getElementById('sStrictThresh').value   = sm.threshold     ?? 3;
  document.getElementById('sStrictBypass').value   = sm.bypassMinutes ?? 30;
  document.getElementById('sStrictHours').checked  = sm.activeHours?.enabled ?? false;
  document.getElementById('sStrictStart').value    = sm.activeHours?.start ?? 9;
  document.getElementById('sStrictEnd').value      = sm.activeHours?.end ?? 17;
  document.getElementById('sStrictHard').checked   = sm.hardLockUntilTomorrow ?? false;
  document.getElementById('sStrictPerSite').value  = thresholdsToText(sm.perSiteThresholds);
  document.getElementById('sStrictStatus').textContent = sm.enabled ? 'ON' : 'OFF';
  document.getElementById('sStrictStatus').className   = `badge ${sm.enabled?'badge-danger':'badge-accent'}`;
  document.getElementById('sThreshDisplay').textContent = sm.threshold ?? 3;
  // Blocked sites list
  const blocked = sm.blockedDomains || [];
  const bl = document.getElementById('blockedSitesList');
  bl.innerHTML = !blocked.length
    ? '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">No sites blocked yet.</div>'
    : blocked.map(d => `
        <div class="blocked-item">
          <span class="blocked-domain">${esc(d)}</span>
          <button class="btn-secondary" style="font-size:11px;padding:3px 10px" data-unblock="${esc(d)}">Unblock</button>
        </div>`).join('');
  bl.querySelectorAll('[data-unblock]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const domain = btn.dataset.unblock;
      const sm2 = settings.strictMode || {};
      sm2.blockedDomains = (sm2.blockedDomains||[]).filter(x=>x!==domain);
      settings.strictMode = sm2;
      await msg('SAVE_SETTINGS', settings);
      renderSettings();
    });
  });
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>{
    n.classList.remove('active');
    n.removeAttribute('aria-current');
  });
  document.getElementById(`page-${page}`)?.classList.add('active');
  const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
  activeNav?.classList.add('active');
  activeNav?.setAttribute('aria-current', 'page');
  ({overview:renderOverview, sites:renderSites, patterns:renderPatterns,
    score:renderScore, gamify:renderGamify, summary:renderSummary,
    history:renderHistory, settings:renderSettings})[page]?.();
}

// ─── Load All Data ────────────────────────────────────────────────────────────

async function loadAll() {
  const [sessions, summaries, scores, patterns, sets, G, ivLog, current] = await Promise.all([
    msg('GET_SESSIONS', { includeCurrent: true }), msg('GET_DAILY_SUMMARIES'), msg('GET_DISCIPLINE_SCORES'),
    msg('GET_PATTERN_HISTORY'), msg('GET_SETTINGS'), msg('GET_GAMIFICATION'),
    msg('GET_INTERVENTION_LOG'),
    msg('GET_CURRENT_SESSION')
  ]);

  allSessions     = Array.isArray(sessions)   ? sessions   : [];
  allSummaries    = summaries  && typeof summaries  ==='object' ? summaries  : {};
  allScores       = scores     && typeof scores     ==='object' ? scores     : {};
  allPatterns     = Array.isArray(patterns)   ? patterns   : [];
  settings        = sets       && typeof sets       ==='object' ? sets       : {};
  gamification    = G ?? { streak:{current:0,longest:0}, achievements:[], totalFocusedResponses:0 };
  interventionLog = Array.isArray(ivLog)       ? ivLog      : [];

  // Live session
  if (current) {
    const lv = document.getElementById('navLive');
    lv.style.display = 'block';
    document.getElementById('navLiveDomain').textContent = current.domain || '';
    const dot = document.getElementById('navLiveDot');
    dot.className = `pulse-dot ${current.isDistraction?'pulse-dot-red':'pulse-dot-green'}`;
  }

  navigate(currentPage);
}

// ─── Event Bindings ───────────────────────────────────────────────────────────

document.querySelectorAll('.nav-item').forEach(el =>
  el.addEventListener('click', () => navigate(el.dataset.page))
);

document.querySelectorAll('.toggle-row').forEach(row => {
  const input = row.querySelector('input');
  const label = row.querySelector('.tl')?.textContent?.trim();
  if (input && label && !input.getAttribute('aria-label')) input.setAttribute('aria-label', label);
});

document.getElementById('datePrev').addEventListener('click', () => {
  currentDk = addDays(currentDk, -1);
  if (currentPage==='overview') renderOverview();
  if (currentPage==='sites')    renderSites();
});
document.getElementById('dateNext').addEventListener('click', () => {
  if (currentDk < getDateKey()) {
    currentDk = addDays(currentDk, 1);
    if (currentPage==='overview') renderOverview();
    if (currentPage==='sites')    renderSites();
  }
});

document.querySelectorAll('[data-dash-pause]').forEach(btn => btn.addEventListener('click', () => {
  document.getElementById('sPauseUntil').value = toDatetimeLocal(Date.now() + Number(btn.dataset.dashPause) * 60000);
}));

document.getElementById('btnResumeTracking').addEventListener('click', () => {
  document.getElementById('sPauseUntil').value = '';
});

async function generateSummary() {
  const btn = document.getElementById('btnGenSummary');
  btn.textContent='Generating…'; btn.disabled=true;
  const s = await msg('GENERATE_SUMMARY', { dateKey: currentDk });
  if (s) { allSummaries[currentDk] = s; }
  const sc = await msg('GET_DISCIPLINE_SCORES');
  if (sc) allScores = sc;
  const G2 = await msg('GET_GAMIFICATION');
  if (G2) gamification = G2;
  btn.textContent='Generate Summary'; btn.disabled=false;
  navigate(currentPage);
}

document.getElementById('btnGenSummary').addEventListener('click', generateSummary);
document.getElementById('btnRecompute').addEventListener('click', async () => {
  const btn = document.getElementById('btnRecompute');
  btn.textContent='Computing…'; btn.disabled=true;
  const s = await msg('COMPUTE_SCORE', { dateKey: getDateKey() });
  if (s) allScores[getDateKey()] = s;
  btn.textContent='Recompute Today'; btn.disabled=false;
  renderScore();
});

document.getElementById('btnGenReport').addEventListener('click', async () => {
  const btn = document.getElementById('btnGenReport');
  btn.textContent='Generating…'; btn.disabled=true;
  const s = await msg('GENERATE_SUMMARY', { dateKey: getDateKey() });
  if (s) allSummaries[getDateKey()] = s;
  btn.textContent="Generate Today's Report"; btn.disabled=false;
  renderSummary();
});

document.getElementById('btnSave').addEventListener('click', async () => {
  const btn = document.getElementById('btnSave');
  const sm = settings.strictMode || {};
  const newSettings = {
    notificationsEnabled:    document.getElementById('sNotif').checked,
    interventionEnabled:     document.getElementById('sInterv').checked,
    dailySummaryEnabled:     document.getElementById('sDaily').checked,
    warningThresholdMins:    readNumber('sThresh', 30, 1, 1440),
    loopDetectionVisits:     readNumber('sLoopV', 4, 2, 100),
    loopDetectionWindowMins: readNumber('sLoopW', 15, 1, 1440),
    dataRetentionDays:       readNumber('sRetention', 90, 1, 3650),
    trackingPausedUntil:     fromDatetimeLocal(document.getElementById('sPauseUntil').value),
    neverTrackDomains:       readDomainLines('sNeverTrack'),
    distractionSites:        readDomainLines('sDisSites'),
    productiveSites:         readDomainLines('sProdSites'),
    strictMode: {
      ...sm,
      enabled:   document.getElementById('sStrict').checked,
      threshold: readNumber('sStrictThresh', 3, 1, 50),
      bypassMinutes: readNumber('sStrictBypass', 30, 1, 1440),
      activeHours: {
        enabled: document.getElementById('sStrictHours').checked,
        start: readNumber('sStrictStart', 0, 0, 23),
        end: readNumber('sStrictEnd', 0, 0, 23)
      },
      hardLockUntilTomorrow: document.getElementById('sStrictHard').checked,
      perSiteThresholds: textToThresholds(document.getElementById('sStrictPerSite').value)
    }
  };
  const saved = await msg('SAVE_SETTINGS', newSettings);
  settings = saved || newSettings;
  btn.textContent='Saved ✓';
  setTimeout(() => btn.textContent='Save Settings', 2000);
  renderSettings();
});

document.getElementById('btnUnblockAll').addEventListener('click', async () => {
  if (!confirm('Unblock all blocked sites?')) return;
  const sm = settings.strictMode || {};
  sm.blockedDomains = [];
  settings.strictMode = sm;
  await msg('SAVE_SETTINGS', settings);
  renderSettings();
});

document.getElementById('btnClear').addEventListener('click', async () => {
  if (!confirm('Permanently delete ALL data? This cannot be undone.')) return;
  await msg('CLEAR_DATA');
  allSessions=[]; allSummaries={}; allScores={}; allPatterns=[];
  gamification={ streak:{current:0,longest:0}, achievements:[], totalFocusedResponses:0 };
  interventionLog=[];
  navigate(currentPage);
});

document.getElementById('btnExport').addEventListener('click', async () => {
  const data = await new Promise(r => chrome.storage.local.get(null, r));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `auto-life-logger-${getDateKey()}.json`;
  a.click(); URL.revokeObjectURL(url);
});

document.getElementById('btnExportSettings').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ settings }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `auto-life-logger-settings-${getDateKey()}.json`;
  a.click(); URL.revokeObjectURL(url);
});

document.getElementById('btnImportSettings').addEventListener('click', () => {
  document.getElementById('settingsImportFile').click();
});

document.getElementById('settingsImportFile').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const saved = await msg('SAVE_SETTINGS', parsed.settings || parsed);
    if (saved) {
      settings = saved;
      renderSettings();
      alert('Settings imported.');
    }
  } catch {
    alert('Could not import that settings file.');
  } finally {
    e.target.value = '';
  }
});

document.getElementById('btnOptions').addEventListener('click', () => {
  location.href = chrome.runtime.getURL('options.html');
});

// Resize → redraw
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => navigate(currentPage), 160); });

// Poll for live updates every 30 s
setInterval(async () => {
  const cur = await msg('GET_CURRENT_SESSION');
  const lv  = document.getElementById('navLive');
  if (cur) {
    lv.style.display = 'block';
    document.getElementById('navLiveDomain').textContent = cur.domain||'';
    document.getElementById('navLiveDot').className = `pulse-dot ${cur.isDistraction?'pulse-dot-red':'pulse-dot-green'}`;
  } else lv.style.display = 'none';

  if (currentPage === 'overview' || currentPage === 'sites') {
    const s = await msg('GET_SESSIONS', { includeCurrent: true });
    if (Array.isArray(s)) { allSessions = s; navigate(currentPage); }
  }
}, 30000);

// Boot
loadAll();
