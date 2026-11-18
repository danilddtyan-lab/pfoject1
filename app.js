/* ===== 1. Настройки Supabase ===== */
const CONFIG = {
  SUPABASE_URL: 'https://gbvmbvylnrbtatnrjdsl.supabase.co',
  SUPABASE_KEY: 'sb_publishable_26fxCLV3FFrVWLFdEOAXyw_UvIdakhC'
};

/* ===== 2. Общая шапка и подвал ===== */
const NAV = [
  ['index.html', 'Home'],
  ['gallery.html', 'Gallery'],
  ['top.html', 'Leaderboard'],
  ['add-peak.html', 'Log a peak']
];

const here = location.pathname.split('/').pop() || 'index.html';
const header = document.getElementById('site-header');
const footer = document.getElementById('site-footer');

if (header) {
  header.innerHTML = `
    <a class="logo" href="index.html">Ala-Archa <small>NATURE PARK</small></a>
    <nav class="nav" aria-label="Main">
      ${NAV.map(([href, title]) =>
        `<a class="nav__link" href="${href}"${href === here ? ' aria-current="page"' : ''}>${title}</a>`
      ).join('')}
    </nav>`;
}

if (footer) {
  footer.innerHTML = '<b>Ala-Archa</b>Nature park, Kyrgyzstan';
}

/* ===== 3. Работа с Supabase ===== */
let sb = null;

const ready = (async () => {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
    throw new Error('SUPABASE_URL или SUPABASE_KEY не заданы.');
  }

  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Не удалось загрузить Supabase client с CDN.'));
      document.head.appendChild(script);
    });
  }

  sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
})();

const store = {
  async peaks() {
    await ready;
    const { data, error } = await sb
      .from('peaks')
      .select('*')
      .order('height_m', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async ascents() {
    await ready;
    const { data, error } = await sb
      .from('ascents')
      .select('*, peaks(name,height_m,difficulty)');
    if (error) throw error;
    return data || [];
  },

  async addAscent(ascent) {
    await ready;
    const { error } = await sb.from('ascents').insert(ascent);
    if (error) throw error;
  }
};

const points = peak => {
  const height = Number(peak.height_m) || 0;
  const difficulty = Number(peak.difficulty) || 0;
  return Math.round(height / 100) + difficulty * 10;
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

/* ===== 4. Логика страниц ===== */
const page = document.body.dataset.page;

if (page === 'top') {
  const list = document.getElementById('board');

  if (list) {
    store.ascents().then(rows => {
      const climbers = {};

      rows.forEach(row => {
        if (!row.climber_name || !row.peaks) return;

        const name = String(row.climber_name).trim();
        if (!name) return;

        const key = name.toLowerCase();
        const climber = climbers[key] ||= { name, n: 0, max: 0, pts: 0 };
        const height = Number(row.peaks.height_m) || 0;

        climber.n++;
        climber.max = Math.max(climber.max, height);
        climber.pts += points(row.peaks);
      });

      const top = Object.values(climbers)
        .sort((a, b) => b.pts - a.pts || b.max - a.max || a.name.localeCompare(b.name));

      list.innerHTML = top.length
        ? top.map((climber, index) => `
            <li>
              <span class="rank">${index + 1}</span>
              <span>${esc(climber.name)}<small>${climber.n} ascents, highest ${climber.max} m</small></span>
              <span class="pts">${climber.pts} pts</span>
            </li>`).join('')
        : '<li class="empty">No ascents yet. <a href="add-peak.html">Log the first one.</a></li>';
    }).catch(error => {
      console.error('Ошибка загрузки таблицы лидеров из Supabase:', error);
      list.innerHTML = '<li class="empty">Не удалось загрузить данные. Проверьте подключение и политики доступа Supabase.</li>';
    });
  }
}

if (page === 'add') {
  const form = document.getElementById('ascent-form');
  const msg = document.getElementById('msg');

  if (form && msg) {
    const nameInput = form.elements.name;
    const peakSelect = form.elements.peak;
    const dateInput = form.elements.date;

    if (dateInput) {
      const today = new Date();
      const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      dateInput.max = localToday;
      dateInput.value = localToday;
    }

    store.peaks().then(peaks => {
      peakSelect.innerHTML = '<option value="" disabled selected>Choose a peak</option>' +
        peaks.map(peak =>
          `<option value="${Number(peak.id)}">${esc(peak.name)}, ${esc(peak.height_m)} m</option>`
        ).join('');

      peakSelect.disabled = peaks.length === 0;
    }).catch(error => {
      console.error('Ошибка загрузки пиков из Supabase:', error);
      peakSelect.innerHTML = '<option value="" disabled selected>Ошибка загрузки пиков</option>';
      peakSelect.disabled = true;
    });

    form.onsubmit = async event => {
      event.preventDefault();

      if (!form.reportValidity()) return;

      const peakId = Number(peakSelect.value);
      if (!Number.isFinite(peakId) || peakId <= 0) {
        msg.className = 'msg err';
        msg.textContent = 'Выберите пик из списка.';
        return;
      }

      msg.className = 'msg';
      msg.textContent = 'Saving...';

      try {
        await store.addAscent({
          climber_name: nameInput.value.trim(),
          peak_id: peakId,
          climbed_on: dateInput.value,
          note: form.elements.note.value.trim() || null
        });

        msg.innerHTML = 'Ascent saved. <a href="top.html">See the leaderboard</a>';
        form.reset();
        if (dateInput) dateInput.value = dateInput.max;
      } catch (error) {
        console.error('Ошибка сохранения восхождения в Supabase:', error);
        msg.className = 'msg err';
        msg.textContent = 'Не удалось сохранить. Проверьте таблицы и политики доступа Supabase.';
      }
    };
  }
}
