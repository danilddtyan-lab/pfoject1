
/* ===js для базы данных и одинаковых элементов страниц== */

/* ===== 1. Настройки ===== */
// Адрес проекта Supabase и публичный (publishable) ключ. Публичный ключ безопасен в браузере,
// если в базе включена защита строк (RLS). Секретный ключ (sb_secret_...) сюда вставлять нельзя.
const CONFIG = {
  SUPABASE_URL: 'https://gbvmbvylnrbtatnrjdsl.supabase.co',
  SUPABASE_KEY: 'sb_publishable_26fxCLV3FFrVWLFdEOAXyw_UvIdakhC'
};

// Пункты меню. Обычный пункт: [data-page, адрес страницы, подпись]. По data-page подсвечивается текущая страница.
// Выпадающий список: ['group', подпись, [[адрес, подпись], ...]]. Адрес null = страница скоро (не ссылка).
// Пустая строка '' вместо пункта рисует разделитель.
const NAV = [
  ['home', 'index.html', 'Главная'],
  ['group', 'Ущелья', [
    ['gorges/ala-archa.html', 'Ала-Арча'],
    [null, 'Ак-Сай (скоро)'],
    [null, 'Аламедин (скоро)'],
    [null, 'Алтын-Арашан (скоро)'],
    [null, 'Каракол (скоро)']
  ]],
  ['group', 'Маршруты', [
    ['routes/ratsek-hut.html', 'Приют Рацека'],
    ['routes/peaks.html', 'Вершины Ала-Арчи'],
    ['routes/valley-walk.html', 'Прогулка по долине'],
    '',
    ['routes.html', 'Все маршруты']
  ]],
  ['gallery', 'gallery.html', 'Галерея'],
  ['top', 'top.html', 'Рейтинг'],
  ['add', 'add-peak.html', 'Отметить вершину']
];

// Имя текущей страницы берём из <body data-page="...">; от него зависит, какая логика ниже запустится.
const page = document.body.dataset.page;

/* ===== 2. Шапка и подвал ===== */
// Один пункт меню: обычная ссылка (у текущей страницы ставим aria-current) или выпадающий список.
const navItem = ([key, a, b]) => {
  if (key !== 'group') return `<a class="nav__link" href="${a}"${key === page ? ' aria-current="page"' : ''}>${b}</a>`;
  const links = b.map(item => item === '' ? '<hr>'
    : item[0] ? `<a href="${item[0]}">${item[1]}</a>` : `<span>${item[1]}</span>`).join('');
  return `<div class="nav__group">
      <button class="nav__link nav__btn" type="button" aria-expanded="false" aria-haspopup="true">${a}</button>
      <div class="nav__menu">${links}</div>
    </div>`;
};

// Вставляем логотип и меню.
const header = document.getElementById('site-header');
if (header) {
  header.innerHTML = `
    <a class="logo" href="index.html">Горы Кыргызстана <small>ПУТЕВОДИТЕЛЬ</small></a>
    <nav class="nav" aria-label="Главное меню">${NAV.map(navItem).join('')}</nav>`;

  // Выпадающие списки открываются кликом (телефоны, клавиатура); на компьютере ещё и по наведению.
  const groups = header.querySelectorAll('.nav__group');
  const closeAll = () => groups.forEach(g => {
    g.classList.remove('is-open');
    g.querySelector('.nav__btn').setAttribute('aria-expanded', 'false');
  });
  groups.forEach(g => g.querySelector('.nav__btn').addEventListener('click', e => {
    const wasOpen = g.classList.contains('is-open');
    closeAll();
    if (!wasOpen) { g.classList.add('is-open'); e.currentTarget.setAttribute('aria-expanded', 'true'); }
  }));
  document.addEventListener('click', e => { if (!e.target.closest('.nav__group')) closeAll(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
}
const footer = document.getElementById('site-footer');
if (footer) footer.innerHTML = '<b>Горы Кыргызстана</b>Ущелья, маршруты и вершины Кыргызстана';

/* ===== 3. Вспомогательные функции ===== */
// Экранирует спецсимволы, чтобы текст из базы не превратился в HTML-код (защита от XSS).
const esc = value => String(value ?? '').replace(/[&<>"']/g,
  ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// Правильная форма слова по числу: plural(5, ['очко', 'очка', 'очков']) → «очков».
const plural = (n, [one, few, many]) => {
  const m = Math.abs(n) % 100, d = m % 10;
  return m > 10 && m < 20 ? many : d === 1 ? one : d > 1 && d < 5 ? few : many;
};

// Очки за вершину: высота в сотнях метров + 10 за каждый уровень сложности.
const points = peak => Math.round((Number(peak.height_m) || 0) / 100) + (Number(peak.difficulty) || 0) * 10;

// Число с пробелом между тысячами: 4895 → «4 895».
const fmt = n => Number(n).toLocaleString('ru-RU');

/* ===== 4. Работа с базой данных (REST API Supabase) ===== */
// Универсальный запрос к таблице. Без внешних библиотек: меньше кода и быстрее загрузка.
// path: «таблица?параметры»; options: метод и тело. Через 10 секунд запрос прерывается.
async function api(path, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      signal: ctrl.signal,
      headers: { apikey: CONFIG.SUPABASE_KEY, 'Content-Type': 'application/json', ...options.headers }
    });
    const text = await res.text();                       // при вставке тело ответа пустое, поэтому не res.json()
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${data?.message || res.statusText}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// Три операции, которые нужны сайту.
const store = {
  // Вершины от самой высокой к низкой (для выпадающего списка).
  peaks: () => api('peaks?select=id,name,height_m,difficulty&order=height_m.desc'),
  // Восхождения вместе с данными вершины (имя участника + высота и сложность для подсчёта очков).
  ascents: () => api('ascents?select=climber_name,peaks(height_m,difficulty)'),
  // Новое восхождение; return=minimal говорит базе не присылать запись обратно.
  addAscent: ascent => api('ascents', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(ascent) })
};

/* ===== 5. Страница «Галерея» ===== */
if (page === 'gallery') {
  const dlg = document.getElementById('viewer');
  const big = dlg.querySelector('img');
  const caption = dlg.querySelector('p');

  document.querySelectorAll('.ph').forEach(btn => {
    const img = btn.querySelector('img');
    // Если файла фото нет, показываем нейтральную плитку и отключаем кнопку.
    const markMissing = () => { btn.classList.add('ph--missing'); btn.disabled = true; };
    img.addEventListener('error', markMissing);
    if (img.complete && img.naturalWidth === 0) markMissing();   // ошибка могла случиться до подключения скрипта

    // Клик по фото открывает его крупно во всплывающем окне.
    btn.addEventListener('click', () => {
      big.src = img.currentSrc || img.src;
      big.alt = img.alt;
      caption.textContent = img.alt;
      dlg.showModal();
    });
  });

  // Закрываем окно по кнопке «Закрыть» или по клику на тёмный фон (Esc работает сам).
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('.btn')) dlg.close(); });
}

/* ===== 6. Страница «Рейтинг» ===== */
if (page === 'top') {
  const list = document.getElementById('board');
  const showMessage = html => { list.innerHTML = `<li class="empty">${html}</li>`; };

  store.ascents().then(rows => {
    // Группируем восхождения по имени участника (без учёта регистра и пробелов по краям).
    const climbers = {};
    rows.forEach(row => {
      const name = String(row.climber_name ?? '').trim();
      if (!name || !row.peaks) return;                    // пропускаем записи без имени или без вершины
      const c = climbers[name.toLowerCase()] ||= { name, n: 0, max: 0, pts: 0 };
      c.n++;
      c.max = Math.max(c.max, Number(row.peaks.height_m) || 0);
      c.pts += points(row.peaks);
    });

    // Сортировка: больше очков выше; при равенстве выше тот, кто был на более высокой вершине; затем по алфавиту.
    const top = Object.values(climbers).sort((a, b) => b.pts - a.pts || b.max - a.max || a.name.localeCompare(b.name, 'ru'));

    if (!top.length) return showMessage('Пока нет ни одного восхождения. <a href="add-peak.html">Добавьте первое.</a>');
    list.innerHTML = top.map((c, i) => `
      <li>
        <span class="rank">${i + 1}</span>
        <span>${esc(c.name)}<small>${c.n} ${plural(c.n, ['восхождение', 'восхождения', 'восхождений'])}, максимум ${fmt(c.max)} м</small></span>
        <span class="pts">${c.pts}<small>${plural(c.pts, ['очко', 'очка', 'очков'])}</small></span>
      </li>`).join('');
  }).catch(err => {
    console.error('Ошибка загрузки рейтинга:', err);        // подробности для разработчика
    showMessage('Не удалось загрузить рейтинг. Обновите страницу или попробуйте позже.');
  });
}

/* ===== 7. Страница «Отметить вершину» ===== */
if (page === 'add') {
  const form = document.getElementById('ascent-form');
  const nameInput = document.getElementById('climber-name');
  const peakSelect = document.getElementById('peak-select');
  const dateInput = document.getElementById('climb-date');
  const noteInput = document.getElementById('climb-note');
  const submitBtn = form.querySelector('button[type="submit"]');
  const msg = document.getElementById('msg');

  // Сообщение под формой: isError = true делает текст красным.
  const say = (text, isError = false) => { msg.className = isError ? 'msg err' : 'msg'; msg.innerHTML = text; };

  // Сегодняшняя дата по местному времени (toISOString дал бы дату по UTC, иногда «вчерашнюю»).
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  dateInput.max = today;                                   // будущие даты выбрать нельзя
  dateInput.value = today;

  // Заполняем список вершин из базы.
  store.peaks().then(peaks => {
    if (!peaks.length) { peakSelect.innerHTML = '<option value="" disabled selected>Список вершин пуст</option>'; return; }
    peakSelect.innerHTML = '<option value="" disabled selected>Выберите вершину</option>' +
      peaks.map(p => `<option value="${Number(p.id)}">${esc(p.name)}, ${fmt(p.height_m)} м</option>`).join('');
    peakSelect.disabled = false;
  }).catch(err => {
    console.error('Ошибка загрузки вершин:', err);
    peakSelect.innerHTML = '<option value="" disabled selected>Не удалось загрузить вершины</option>';
    say('Не удалось загрузить список вершин. Обновите страницу или попробуйте позже.', true);
  });

  // Отправка формы: проверяем данные, сохраняем в базу, сообщаем результат.
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (name.length < 2) return say('Введите имя (не короче 2 символов).', true);
    if (!peakSelect.value) return say('Выберите вершину из списка.', true);
    if (!dateInput.value || dateInput.value > today) return say('Укажите дату восхождения, не позже сегодняшней.', true);

    submitBtn.disabled = true;                             // защита от двойной отправки
    say('Сохраняем…');
    try {
      await store.addAscent({
        climber_name: name,
        peak_id: Number(peakSelect.value),
        climbed_on: dateInput.value,
        note: noteInput.value.trim() || null
      });
      form.reset();
      dateInput.value = today;                             // reset() очищает дату, возвращаем сегодняшнюю
      say('Восхождение сохранено. <a href="top.html">Посмотреть рейтинг</a>');
    } catch (err) {
      console.error('Ошибка сохранения восхождения:', err);
      say('Не удалось сохранить. Попробуйте ещё раз чуть позже.', true);
    } finally {
      submitBtn.disabled = false;
    }
  });
}
