/* ===== 1. Настройки Supabase ===== */
// URL проекта и публичный publishable key из Supabase → Project Settings → API.
// Publishable key допустимо использовать в браузере при правильно настроенных RLS-политиках.
const CONFIG = {
  SUPABASE_URL: 
  SUPABASE_KEY: 
};

/* ===== 2. Общие шапка и подвал сайта ===== */
// Ссылки навигации: адрес страницы и подпись ссылки.
const NAV = [['index.html', 'Home'], ['gallery.html', 'Gallery'], ['top.html', 'Top climbers'], ['add-peak.html', 'Log a peak']];
// Получаем имя текущей страницы из адреса браузера.
const here = location.pathname.split('/').pop() || 'index.html';
// Заполняем шапку логотипом и меню; текущей ссылке добавляем aria-current.
document.getElementById('site-header').innerHTML =
  `<a class="logo" href="index.html">Ala-archa <small>nature park</small></a>
   <nav class="nav" aria-label="Main">${NAV.map(([h, t]) =>
    `<a class="nav__link" href="${h}"${h === here ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>`;
// Устанавливаем текст подвала.
document.getElementById('site-footer').textContent = 'Ala-archa nature park';

/* ===== 3. Данные и слой работы с хранилищем ===== */
// Демонстрационные пики используются только если Supabase не настроен.
const SAMPLE_PEAKS = [
  { id: 1, name: 'Semenov-Tian-Shansky Peak', height_m: 4895, difficulty: 3 },
  { id: 2, name: 'Korona Peak', height_m: 4860, difficulty: 4 },
  { id: 3, name: 'Free Korea Peak', height_m: 4740, difficulty: 3 },
  { id: 4, name: 'Uchitel Peak', height_m: 4527, difficulty: 2 },
  { id: 5, name: 'Ratsek Hut', height_m: 3370, difficulty: 1 }
];
// Клиент Supabase будет создан после загрузки библиотеки.
let sb = null;
// Инициализируем клиент один раз и ждём завершения подключения перед запросами.
const ready = (async () => {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
    throw new Error('Не заданы SUPABASE_URL или SUPABASE_KEY.');
  }
  // Загружаем официальный JavaScript-клиент Supabase из CDN.
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Не удалось загрузить клиент Supabase с CDN.'));
    document.head.appendChild(script);
  });
  // Создаём клиент для REST-запросов к Supabase.
  sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
  console.info('Клиент Supabase создан. Доступ к таблицам проверяется при запросе.');
})();
// Ключ хранения восхождений в localStorage (используется в локальном режиме).
const LS = 'aa_ascents';
// Методы чтения и записи данных.
const store = {
  // Загружает пики из таблицы peaks, сортируя по высоте по убыванию.
  async peaks() {
    await ready;
    const { data, error } = await sb.from('peaks').select('*').order('height_m', { ascending: false });
    if (error) throw error;
    return data;
  },
  // Загружает восхождения и связанные записи пиков.
  async ascents() {
    await ready;
    const { data, error } = await sb.from('ascents').select('*, peaks(name,height_m,difficulty)');
    if (error) throw error;
    return data;
  },
  // Добавляет восхождение в таблицу ascents.
  async addAscent(ascent) {
    await ready;
    const { error } = await sb.from('ascents').insert(ascent);
    if (error) throw error;
  }
};
// Рассчитывает очки за высоту и сложность пика.
const points = peak => Math.round(peak.height_m / 100) + peak.difficulty * 10;
// Экранирует спецсимволы HTML перед вставкой текста в разметку.
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/* ===== 4. Логика страниц ===== */
// data-page в HTML определяет, какая логика страницы должна выполняться.
const page = document.body.dataset.page;

// Страница галереи.
if (page === 'gallery') {
  // Список фотографий: файл, подпись, категория.
  const PHOTOS = [
    { src: 'images/ratsek-hut.jpg', title: 'Ratsek Hut, 3,370 m', tag: 'Huts' },
    { src: 'images/korona-peak.jpg', title: 'Korona Peak', tag: 'Peaks' },
    { src: 'images/ala-archa-6.jpg', title: 'Ala-Archa gorge', tag: 'Gorge' }
  ];
  // Категории фильтра: «All» и все уникальные категории фотографий.
  const tags = ['All', ...new Set(PHOTOS.map(photo => photo.tag))];
  // Находим элементы страницы.
  const grid = document.getElementById('gallery'), box = document.getElementById('filters'), dlg = document.getElementById('viewer');
  // Перерисовывает фильтры и фотографии для выбранной категории.
  const draw = tag => {
    box.innerHTML = tags.map(item => `<button aria-pressed="${item === tag}" data-t="${item}">${item}</button>`).join('');
    grid.innerHTML = PHOTOS.filter(photo => tag === 'All' || photo.tag === tag)
      .map(photo => `<button data-s="${esc(photo.src)}" data-c="${esc(photo.title)}"><img src="${esc(photo.src)}" alt="${esc(photo.title)}" loading="lazy"></button>`).join('');
  };
  // Переключает фотографии при выборе фильтра.
  box.onclick = event => event.target.dataset.t && draw(event.target.dataset.t);
  // Открывает нажатую фотографию в диалоговом окне.
  grid.onclick = event => {
    const button = event.target.closest('button');
    if (!button) return;
    dlg.querySelector('img').src = button.dataset.s;
    dlg.querySelector('img').alt = button.dataset.c;
    dlg.querySelector('p').textContent = button.dataset.c;
    dlg.showModal();
  };
  // Закрывает диалог при нажатии на фон или кнопку закрытия.
  dlg.onclick = event => { if (event.target === dlg || event.target.matches('.btn')) dlg.close(); };
  // При загрузке показывает все фотографии.
  draw('All');
}

// Страница таблицы лидеров.
if (page === 'top') {
  const list = document.getElementById('board');
  // Получаем восхождения из Supabase и группируем их по участникам.
  store.ascents().then(rows => {
    const climbers = {};
    rows.forEach(row => {
      const key = row.climber_name.trim().toLowerCase();
      const climber = climbers[key] ||= { name: row.climber_name.trim(), n: 0, max: 0, pts: 0 };
      climber.n++;
      climber.max = Math.max(climber.max, row.peaks.height_m);
      climber.pts += points(row.peaks);
    });
    // Сортирует по сумме очков, затем по максимальной высоте.
    const top = Object.values(climbers).sort((a, b) => b.pts - a.pts || b.max - a.max);
    // Показывает рейтинг или сообщение, если восхождений ещё нет.
    list.innerHTML = top.length
      ? top.map((climber, index) => `<li><span class="rank">${index + 1}</span><span>${esc(climber.name)}<small>${climber.n} ascents, highest ${climber.max} m</small></span><span class="pts">${climber.pts}</span></li>`).join('')
      : '<li class="empty">No ascents yet. <a href="add-peak.html">Log the first one.</a></li>';
  }).catch(error => {
    // Пишем подробности в консоль, чтобы можно было диагностировать подключение и RLS.
    console.error('Ошибка загрузки таблицы лидеров из Supabase:', error);
    list.innerHTML = '<li class="empty">Не удалось загрузить данные. Проверьте подключение и политики доступа Supabase.</li>';
  });
}

// Страница добавления восхождения.
if (page === 'add') {
  const form = document.getElementById('ascent-form'), msg = document.getElementById('msg');
  // Запрещаем будущую дату и устанавливаем сегодняшнюю дату по умолчанию.
  form.date.max = form.date.value = new Date().toISOString().slice(0, 10);
  // Загружает пики из Supabase и добавляет название с высотой в выпадающий список.
  store.peaks().then(peaks => {
    form.peak.innerHTML = '<option value="" disabled selected>Choose a peak</option>' +
      peaks.map(peak => `<option value="${peak.id}" data-height-m="${peak.height_m}">${esc(peak.name)}, ${peak.height_m} m</option>`).join('');
  }).catch(error => {
    // Выводим реальную ошибку (например, неверный ключ, таблица отсутствует или запрос запрещён RLS).
    console.error('Ошибка загрузки пиков из Supabase:', error);
    form.peak.innerHTML = '<option value="" disabled selected>Ошибка загрузки пиков — откройте консоль браузера</option>';
  });
  // Обрабатывает отправку формы восхождения.
  form.onsubmit = async event => {
    event.preventDefault();
    msg.className = 'msg';
    msg.textContent = 'Saving...';
    try {
      // Отправляет поля формы в таблицу ascents.
      await store.addAscent({ climber_name: form.name.value.trim(), peak_id: Number(form.peak.value), climbed_on: form.date.value, note: form.note.value.trim() || null });
      msg.innerHTML = 'Ascent saved. <a href="top.html">See the top list</a>';
      form.reset();
      form.date.value = form.date.max;
    } catch (error) {
      // Подробная ошибка отображается в консоли браузера.
      console.error('Ошибка сохранения восхождения в Supabase:', error);
      msg.className = 'msg err';
      msg.textContent = 'Не удалось сохранить. Проверьте таблицы и политики доступа Supabase.';
    }
  };
}
