/* ===== 1. Settings. Leave empty to run in demo mode (data stays in this browser). ===== */
const CONFIG = { SUPABASE_URL: '', SUPABASE_KEY: '' };
/* ===== 2. Shared header + footer ===== */
const NAV = [['index.html', 'Home'], ['gallery.html', 'Gallery'], ['top.html', 'Top climbers'], ['add-peak.html', 'Log a peak']];
const here = location.pathname.split('/').pop() || 'index.html';
document.getElementById('site-header').innerHTML =
  `<a class="logo" href="index.html">Ala-archa <small>nature park</small></a>
   <nav class="nav" aria-label="Main">${NAV.map(([h, t]) =>
    `<a class="nav__link" href="${h}"${h === here ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>`;
document.getElementById('site-footer').textContent = 'Ala-archa nature park';

/* ===== 3. Data layer. Pages only call `store`, so switching to Supabase changes nothing else. ===== */
const SAMPLE_PEAKS = [ // sample data: check heights and difficulty before publishing
  { id: 1, name: 'Semenov-Tian-Shansky Peak', height_m: 4895, difficulty: 3 },
  { id: 2, name: 'Korona Peak', height_m: 4860, difficulty: 4 },
  { id: 3, name: 'Free Korea Peak', height_m: 4740, difficulty: 3 },
  { id: 4, name: 'Uchitel Peak', height_m: 4527, difficulty: 2 },
  { id: 5, name: 'Ratsek Hut', height_m: 3370, difficulty: 1 }
];
let sb = null;
const ready = (async () => {
  if (!CONFIG.SUPABASE_URL) return;
  await new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.js';
    s.onload = ok; s.onerror = no; document.head.appendChild(s);
  });
  sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
})();
const LS = 'aa_ascents';
const store = {
  async peaks() {
    await ready;
    if (!sb) return SAMPLE_PEAKS;
    const { data, error } = await sb.from('peaks').select('*').order('height_m', { ascending: false });
    if (error) throw error; return data;
  },
  async ascents() {
    await ready;
    if (!sb) return JSON.parse(localStorage.getItem(LS) || '[]')
      .map(a => ({ ...a, peaks: SAMPLE_PEAKS.find(p => p.id === a.peak_id) }));
    const { data, error } = await sb.from('ascents').select('*, peaks(name,height_m,difficulty)');
    if (error) throw error; return data;
  },
  async addAscent(a) {
    await ready;
    if (!sb) { const all = JSON.parse(localStorage.getItem(LS) || '[]'); all.push(a); localStorage.setItem(LS, JSON.stringify(all)); return; }
    const { error } = await sb.from('ascents').insert(a);
    if (error) throw error;
  }
};
const points = p => Math.round(p.height_m / 100) + p.difficulty * 10;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ===== 4. Page logic ===== */
const page = document.body.dataset.page;

if (page === 'gallery') {
  const PHOTOS = [ // add your files here: src, title, tag
    { src: 'images/ratsek-hut.jpg', title: 'Ratsek Hut, 3,370 m', tag: 'Huts' },
    { src: 'images/korona-peak.jpg', title: 'Korona Peak', tag: 'Peaks' },
    { src: 'images/ala-archa-6.jpg', title: 'Ala-Archa gorge', tag: 'Gorge' }
  ];
  const tags = ['All', ...new Set(PHOTOS.map(p => p.tag))];
  const grid = document.getElementById('gallery'), box = document.getElementById('filters'), dlg = document.getElementById('viewer');
  const draw = tag => {
    box.innerHTML = tags.map(t => `<button aria-pressed="${t === tag}" data-t="${t}">${t}</button>`).join('');
    grid.innerHTML = PHOTOS.filter(p => tag === 'All' || p.tag === tag)
      .map(p => `<button data-s="${esc(p.src)}" data-c="${esc(p.title)}"><img src="${esc(p.src)}" alt="${esc(p.title)}" loading="lazy"></button>`).join('');
  };
  box.onclick = e => e.target.dataset.t && draw(e.target.dataset.t);
  grid.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    dlg.querySelector('img').src = b.dataset.s; dlg.querySelector('img').alt = b.dataset.c;
    dlg.querySelector('p').textContent = b.dataset.c; dlg.showModal();
  };
  dlg.onclick = e => { if (e.target === dlg || e.target.matches('.btn')) dlg.close(); };
  draw('All');
}

if (page === 'top') {
  const list = document.getElementById('board');
  store.ascents().then(rows => {
    const by = {};
    rows.forEach(r => {
      const k = r.climber_name.trim().toLowerCase();
      const u = by[k] ||= { name: r.climber_name.trim(), n: 0, max: 0, pts: 0 };
      u.n++; u.max = Math.max(u.max, r.peaks.height_m); u.pts += points(r.peaks);
    });
    const top = Object.values(by).sort((a, b) => b.pts - a.pts || b.max - a.max);
    list.innerHTML = top.length
      ? top.map((u, i) => `<li><span class="rank">${i + 1}</span><span>${esc(u.name)}<small>${u.n} ascents, highest ${u.max} m</small></span><span class="pts">${u.pts}</span></li>`).join('')
      : '<li class="empty">No ascents yet. <a href="add-peak.html">Log the first one.</a></li>';
  }).catch(() => list.innerHTML = '<li class="empty">Could not load the list. Check the connection and reload.</li>');
}

if (page === 'add') {
  const f = document.getElementById('ascent-form'), msg = document.getElementById('msg');
  f.date.max = f.date.value = new Date().toISOString().slice(0, 10);
  store.peaks().then(ps => {
    f.peak.innerHTML = '<option value="" disabled selected>Choose a peak</option>' +
      ps.map(p => `<option value="${p.id}" data-height-m="${p.height_m}">${esc(p.name)}, ${p.height_m} m</option>`).join('');
  }).catch(() => {
    f.peak.innerHTML = '<option value="" disabled selected>Could not load peaks</option>';
  });
  f.onsubmit = async e => {
    e.preventDefault(); msg.className = 'msg'; msg.textContent = 'Saving...';
    try {
      await store.addAscent({ climber_name: f.name.value.trim(), peak_id: +f.peak.value, climbed_on: f.date.value, note: f.note.value.trim() || null });
      msg.innerHTML = 'Ascent saved. <a href="top.html">See the top list</a>'; f.reset(); f.date.value = f.date.max;
    } catch (err) { msg.className = 'msg err'; msg.textContent = 'Could not save the ascent. Check the fields and try again.'; }
  };
}
