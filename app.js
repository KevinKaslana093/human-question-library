const $ = selector => document.querySelector(selector);
const bookByN = n => BOOKS.find(book => book.n === Number(n));
const themeById = id => THEMES.find(theme => theme.id === id);
const normalize = value => (value || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
const hashText = text => [...text].reduce((sum, ch) => ((sum << 5) - sum + ch.charCodeAt(0)) | 0, 0) >>> 0;
const pick = (items, seed = 0) => items[seed % items.length];

let visibleLimit = 12;
let activeTheme = '';
const COVER_SEED = {
  1:{coverId:13129044,key:'/works/OL2950942W'}, 2:{coverId:12725620,key:'/works/OL74128W'},
  3:{coverId:8179733,key:'/works/OL17872278W'}, 11:{coverId:13316390,key:'/works/OL27955361W'},
  21:{coverId:8634250,key:'/works/OL17075811W'}, 32:{coverId:42317,key:'/works/OL31111W'},
  41:{coverId:8176873,key:'/works/OL17870214W'}, 51:{coverId:10873626,key:'/works/OL44998170W'},
  52:{coverId:5547578}, 53:{coverId:606063}, 91:{coverId:13046820,key:'/works/OL20033315W'}
};
let storedCovers = {};
try { storedCovers = JSON.parse(localStorage.getItem('human-library-covers-v2') || '{}'); } catch {}
let coverMap = {...COVER_SEED, ...storedCovers};

const ACTIONS = {
  mind:'把问题再写一遍，然后连续补上三个“为什么”。第三个问题通常比第一个更靠近你真正想知道的事。',
  create:'给自己十五分钟，只做一个很小、甚至有点粗糙的版本；今天先让它存在。',
  connect:'把“你应该”换成“我观察到／我感到／我需要／我请求”，试着说一次。',
  love:'分两栏写下：这段关系里我正在请求什么，我正在害怕什么。不要急着让两栏一致。',
  body:'先不评价，留意身体此刻最明显的一处感觉，并问它需要靠近、停下还是离开。',
  self:'把下一步缩小到十分钟内能完成，而且不依赖任何人改变的动作。',
  emotion:'把“我很难受”补成更细的一句：“我感到____，因为我在乎／需要____。”',
  society:'问三个问题：谁制定规则、谁从中获益、谁承担了没有被看见的成本？',
  world:'把时间尺度分别拉到一年、十年和一百年，再看一次这个问题。',
  existence:'今天先不用找到终极答案，只做一件能代表你愿意怎样活的小事。'
};

const CRISIS_WORDS = ['不想活','自杀','轻生','结束生命','伤害自己','活不下去'];

function displayTag(id) {
  const theme = themeById(id);
  const extras = {risk:'风险',empathy:'共情',growth:'成长',failure:'失败',healing:'修复',maturity:'成熟',
    trauma:'创伤',myth:'神话',mental_health:'心理健康',emotion:'情绪',rest:'休息',city:'城市',humanity:'人性',
    generosity:'给予',colonialism:'殖民',violence:'暴力',race:'种族',law:'法律',privacy:'隐私',gratitude:'感恩',
    interdependence:'共生',ethics:'伦理',intelligence:'智能',bias:'偏差',resistance:'抵抗',story:'叙事',
    experience:'体验',journey:'旅程',quality:'良质',philosophy:'哲学',simplicity:'简朴',travel:'远行',beauty:'美'};
  return theme ? theme.label : (extras[id] || id.replace(/-/g, ' '));
}

function coverUrlFor(book, size = 'large') {
  if (book.localCover) {
    return `assets/covers/${String(book.n).padStart(3,'0')}.jpg`;
  }
  const data = coverMap[book.n];
  if (data?.coverId) {
    return `https://covers.openlibrary.org/b/id/${data.coverId}-${size === 'small' ? 'M' : 'L'}.jpg`;
  }
  return '';
}

function coverMarkup(book, size = 'large') {
  const url = coverUrlFor(book, size);
  if (url) return `<img src="${url}" alt="《${book.zh}》封面">`;
  return `<div class="cover-skeleton" role="img" aria-label="《${book.zh}》封面正在加载"></div>`;
}

function preloadCover(book, size = 'large') {
  const url = coverUrlFor(book, size);
  if (!url) return Promise.resolve(false);
  return new Promise(resolve => {
    const image = new Image();
    const timer = setTimeout(() => resolve(false), 7000);
    image.onload = () => { clearTimeout(timer); resolve(true); };
    image.onerror = () => { clearTimeout(timer); resolve(false); };
    image.src = url;
  });
}

const HERO_LAYOUT = [
  {n:1,x:'-285px',y:'-225px',w:'108px',r:'-8deg',z:'20px',d:'-.8s'},
  {n:2,x:'-145px',y:'-295px',w:'92px',r:'5deg',z:'70px',d:'-2.1s'},
  {n:3,x:'35px',y:'-245px',w:'120px',r:'3deg',z:'100px',d:'-3.2s'},
  {n:5,x:'210px',y:'-165px',w:'94px',r:'8deg',z:'30px',d:'-1.4s'},
  {n:11,x:'-310px',y:'-15px',w:'118px',r:'4deg',z:'80px',d:'-4s'},
  {n:21,x:'-160px',y:'85px',w:'105px',r:'-6deg',z:'110px',d:'-2.8s'},
  {n:32,x:'30px',y:'155px',w:'98px',r:'5deg',z:'60px',d:'-1.8s'},
  {n:41,x:'230px',y:'80px',w:'112px',r:'-5deg',z:'90px',d:'-3.6s'},
  {n:51,x:'315px',y:'-5px',w:'86px',r:'8deg',z:'20px',d:'-.4s'},
  {n:52,x:'-265px',y:'220px',w:'88px',r:'-3deg',z:'10px',d:'-2.4s'},
  {n:53,x:'145px',y:'275px',w:'92px',r:'7deg',z:'40px',d:'-4.5s'},
  {n:91,x:'330px',y:'225px',w:'104px',r:'-4deg',z:'75px',d:'-1.1s'}
];

function renderHero() {
  if (!$('#heroCovers')) return;
  $('#heroCovers').innerHTML = HERO_LAYOUT.map(item => {
    const book = bookByN(item.n);
    return `<button class="hero-book" data-book="${book.n}" aria-label="打开《${book.zh}》" style="--x:${item.x};--y:${item.y};--w:${item.w};--r:${item.r};--z:${item.z};--delay:${item.d}">${coverMarkup(book)}</button>`;
  }).join('');
}

async function resolveOneCover(book) {
  if (coverMap[book.n]?.coverId) return true;
  try {
    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}&fields=key,title,author_name,cover_i&limit=10`;
    const response = await fetch(url);
    if (!response.ok) return false;
    const data = await response.json();
    const surname = normalize(book.author.split(' ').pop());
    const doc = data.docs.find(item => item.cover_i && (item.author_name || []).some(name => normalize(name).includes(surname))) || data.docs.find(item => item.cover_i);
    if (!doc) return false;
    coverMap[book.n] = {coverId:doc.cover_i, key:doc.key};
    try { localStorage.setItem('human-library-covers-v2', JSON.stringify(coverMap)); } catch {}
    return true;
  } catch { return false; }
}

function renderThemes(domain = 'all') {
  const domains = Object.entries(DOMAIN_NAMES);
  $('#domainTabs').innerHTML = `<button class="active" data-domain="all">全部 100</button>` +
    domains.map(([id,name]) => `<button data-domain="${id}">${name}</button>`).join('');
  const draw = selected => {
    const list = selected === 'all' ? THEMES : THEMES.filter(t => t.domain === selected);
    $('#themeCloud').innerHTML = list.map(t => `<button data-theme="${t.id}"><span>${String(t.index).padStart(2,'0')}</span>${t.label}</button>`).join('');
  };
  draw(domain);
  $('#domainTabs').addEventListener('click', e => {
    const button = e.target.closest('[data-domain]');
    if (!button) return;
    $('#domainTabs').querySelectorAll('button').forEach(b => b.classList.toggle('active', b === button));
    draw(button.dataset.domain);
  });
}

function filteredBooks() {
  const query = normalize($('#bookSearch')?.value || '');
  return BOOKS.filter(book => {
    const themeMatch = !activeTheme || book.tags.includes(activeTheme);
    const haystack = normalize([book.zh, book.title, book.author, book.note, ...book.tags.map(displayTag)].join(' '));
    return themeMatch && (!query || haystack.includes(query));
  });
}

function renderShelf(reset = false) {
  if (reset) visibleLimit = 12;
  const all = filteredBooks();
  const shown = all.slice(0, visibleLimit);
  $('#bookGrid').innerHTML = shown.map(book => `
    <button class="book-card" data-book="${book.n}" aria-label="查看《${book.zh}》详情">
      <span class="num">${String(book.n).padStart(3,'0')}</span>
      <div class="cover-wrap">${coverMarkup(book)}</div>
      <h3>${book.zh}</h3>
      <div class="author">${book.author} · ${book.title}</div>
      <p class="reason">${book.note}</p>
      <div class="card-tags">${book.tags.slice(0,3).map(tag => `<span>${displayTag(tag)}</span>`).join('')}</div>
      <span class="card-arrow">↗</span>
    </button>`).join('') || `<div class="empty-shelf">没有找到完全匹配的书。换个词试试，或者去百词索引随便点一个。</div>`;
  $('#visibleCount').textContent = shown.length;
  $('.shelf-count').lastChild.textContent = ` / ${all.length} 本`;
  $('#loadMore').hidden = shown.length >= all.length;
}

function scoreThemes(text) {
  const clean = normalize(text);
  return THEMES.map(theme => {
    let score = 0;
    for (const word of [theme.label, ...theme.words]) {
      const token = normalize(word);
      if (token && clean.includes(token)) score += Math.max(2, Math.min(7, token.length));
    }
    return {...theme, score};
  }).filter(t => t.score > 0).sort((a,b) => b.score - a.score || a.index - b.index);
}

function recommendBooks(themes, text, limit = 3) {
  const seed = hashText(text);
  const ids = themes.map(t => t.id);
  return BOOKS.map(book => {
    let score = book.tags.reduce((sum, tag) => sum + (ids.includes(tag) ? 9 - ids.indexOf(tag) * 2 : 0), 0);
    score += ((seed + book.n * 17) % 19) / 20;
    return {book, score};
  }).sort((a,b) => b.score - a.score).slice(0, limit).map(x => x.book);
}

function buildResponse(text) {
  if (CRISIS_WORDS.some(word => text.includes(word))) {
    const safetyTheme = themeById('hope');
    return {
      themes:[safetyTheme],
      title:'先不要一个人扛，也先不要做任何伤害自己的决定。',
      body:'你说出的这些话值得被认真对待。这个网页不能替代现实中的帮助：请现在就联系一个你信任的人，让对方来陪你，或陪你去见医生、心理专业人员。如果你觉得自己可能马上伤害自己，请立刻联系当地急救服务或危机援助热线，并远离可能伤害自己的物品。',
      action:'现在就把这句话发给一个可信的人：“我现在不安全，需要你来陪我，并帮我联系专业支持。”',
      books:recommendBooks([safetyTheme, themeById('meaning')], text)
    };
  }

  let themes = scoreThemes(text);
  const countIntent = /(多少本|几本书|书多|馆藏|有多少)/.test(text);
  if (countIntent && !themes.some(t => t.id === 'curiosity')) themes.unshift(themeById('curiosity'));
  if (!themes.length) themes = [themeById('curiosity'), themeById('meaning')];
  themes = themes.slice(0, 3);
  const primary = themes[0];
  const seed = hashText(text);
  const title = countIntent
    ? `你怎么这么好奇呢？这里现在刚好有 ${BOOKS.length} 本书。`
    : primary.line;
  const opener = pick(DOMAIN_RESPONSES[primary.domain], seed);
  const blend = themes.length > 1
    ? `我还在这句话里读到「${themes.slice(1).map(t => t.label).join('」和「')}」。它们放在一起，说明你的问题不只属于一个抽屉。`
    : '它不是一个必须立刻解决的问题，也可以先成为一条继续探索的线索。';
  const sourceWhy = `下面的书并不是因为共享一个表面关键词才出现：它们分别从${themes.map(t => t.label).join('、')}的角度，替这个问题增加新的观察位置。`;
  return {
    themes,
    title,
    body:`${opener}${countIntent ? ` 这一百本书横跨认知、创造、连接、亲密、身体、成长、情绪、社会、未来与存在十个区域。` : ''}${blend}${sourceWhy}`,
    action:ACTIONS[primary.domain],
    books:recommendBooks(themes, text),
  };
}

async function showAnswer() {
  const input = $('#moodInput');
  const text = input.value.trim();
  if (!text) {
    input.focus();
    input.placeholder = '哪怕只写“为什么”也可以。';
    input.closest('.input-card').animate([{transform:'translateX(-5px) rotate(.5deg)'},{transform:'translateX(5px) rotate(.5deg)'},{transform:'translateX(0) rotate(.5deg)'}], {duration:260});
    return;
  }
  const button = $('#submitBtn');
  button.classList.add('loading');
  button.querySelector('span:first-child').textContent = '正在穿过一百本书…';
  setTimeout(async () => {
    const response = buildResponse(text);
    await Promise.all(response.books.map(async book => { await resolveOneCover(book); await preloadCover(book, 'small'); }));
    $('#moodTag').textContent = response.themes.map(t => t.label).join(' × ');
    $('#questionPath').innerHTML = `<span class="path-node">你的问题</span>` + response.themes.map(theme => `<span class="path-line"></span><span class="path-node">${theme.label}</span>`).join('') + `<span class="path-line"></span><span class="path-node">${response.books.length} 本书</span>`;
    $('#answerTitle').textContent = response.title;
    $('#answerText').textContent = response.body;
    $('#smallStep').innerHTML = `<strong>把问题往前推一步｜</strong>${response.action}`;
    $('#inspiredBooks').innerHTML = response.books.map(book => `
      <button class="mini-book" data-book="${book.n}">
        <span class="mini-cover">${coverMarkup(book, 'small')}</span>
        <span><strong>《${book.zh}》</strong><span>${book.note}</span><em>${book.tags.filter(t => response.themes.some(x => x.id === t)).map(displayTag).join(' · ') || '换一个观察位置'}</em></span>
      </button>`).join('');
    $('#answer').hidden = false;
    $('#answer').classList.remove('reveal');
    void $('#answer').offsetWidth;
    $('#answer').classList.add('reveal');
    button.classList.remove('loading');
    button.querySelector('span:first-child').textContent = '让一百本书回答';
    $('#answer').scrollIntoView({behavior:'smooth', block:'start'});
  }, 620);
}

let modalHistoryActive = false;
let activeModalBookNumber = 1;

async function openBook(n, sourceElement) {
  const book = bookByN(n);
  activeModalBookNumber = Number(book.n);
  await resolveOneCover(book);
  await preloadCover(book);
  const details = coverMap[book.n] || {};
  $('#modalNum').textContent = String(book.n).padStart(3,'0');
  const visual = $('.modal-visual');
  visual.querySelector('.modal-cover-shell')?.remove();
  const shell = document.createElement('div');
  shell.className = 'modal-cover-shell';
  shell.innerHTML = coverMarkup(book);
  visual.insertBefore(shell, $('.modal-stage-caption'));
  $('#modalMood').textContent = book.tags.slice(0,4).map(displayTag).join(' / ');
  $('#modalStageTitle').textContent = book.zh;
  $('#modalThemeChips').innerHTML = book.tags.slice(0,4).map(tag => `<button data-modal-theme="${tag}">${displayTag(tag)}</button>`).join('');
  $('#modalTitle').textContent = book.zh;
  $('#modalAuthor').textContent = `${book.author} · ${book.title}`;
  $('#modalIntro').textContent = book.note;
  $('#modalIdeas').innerHTML = book.tags.slice(0,6).map(tag => {
    const theme = themeById(tag);
    return `<li><strong>${displayTag(tag)}</strong>${theme ? `<span>${theme.line}</span>` : ''}</li>`;
  }).join('');
  const mainTheme = book.tags.map(themeById).find(Boolean);
  $('#modalQuote').textContent = `“${mainTheme?.line || '一本书不会替你结束问题，但会改变你提问的位置。'}”`;
  $('#modalNavCount').textContent = `${String(book.n).padStart(3,'0')} / ${String(BOOKS.length).padStart(3,'0')}`;
  $('#modalSource').href = details.key ? `https://openlibrary.org${details.key}` : `https://openlibrary.org/search?q=${encodeURIComponent(book.title + ' ' + book.author)}`;
  const sourceMedia = sourceElement?.querySelector('img');
  const targetMedia = shell.querySelector('img');
  const transitionName = `book-cover-${book.n}`;
  if (sourceMedia) sourceMedia.style.viewTransitionName = transitionName;
  const revealModal = () => {
    if (sourceMedia) sourceMedia.style.viewTransitionName = '';
    if (targetMedia) targetMedia.style.viewTransitionName = transitionName;
    $('#bookModal').scrollTop = 0;
    $('#modalProgress').style.width = '0%';
    $('#bookModal').hidden = false;
    document.body.style.overflow = 'hidden';
    if (!modalHistoryActive) {
      history.pushState({ humanLibraryBook: book.n }, '', `#book-${String(book.n).padStart(3,'0')}`);
      modalHistoryActive = true;
    } else {
      history.replaceState({ humanLibraryBook: book.n }, '', `#book-${String(book.n).padStart(3,'0')}`);
    }
  };
  if (document.startViewTransition && sourceMedia && targetMedia) {
    const transition = document.startViewTransition(revealModal);
    transition.finished.finally(() => {
      targetMedia.style.viewTransitionName = '';
      $('#modalClose').focus();
    });
  } else {
    revealModal();
    $('#modalClose').focus();
  }
}

function closeBook(fromHistory = false) {
  $('#bookModal').hidden = true;
  $('#bookModal').scrollTop = 0;
  document.body.style.overflow = '';
  if (modalHistoryActive && !fromHistory) {
    modalHistoryActive = false;
    history.back();
  } else if (fromHistory) {
    modalHistoryActive = false;
  }
}

async function hydrateCovers() {
  const missing = BOOKS.filter(book => !coverMap[book.n]?.coverId);
  if (!missing.length) return;
  const batches = [];
  for (let i = 0; i < missing.length; i += 10) batches.push(missing.slice(i, i + 10));
  for (const batch of batches) {
    try {
      const query = batch.map(book => `title:"${book.title.replace(/"/g, '')}"`).join(' OR ');
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=key,title,author_name,cover_i&limit=80`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Open Library ${response.status}`);
      const data = await response.json();
      batch.forEach(book => {
        const wantedTitle = normalize(book.title);
        const surname = normalize(book.author.split(' ').pop());
        const candidates = data.docs.filter(doc => normalize(doc.title) === wantedTitle && doc.cover_i);
        const doc = candidates.find(item => (item.author_name || []).some(name => normalize(name).includes(surname))) || candidates[0];
        if (doc) coverMap[book.n] = {coverId:doc.cover_i, key:doc.key};
      });
      localStorage.setItem('human-library-covers-v2', JSON.stringify(coverMap));
      renderShelf();
      renderHero();
    } catch (error) {
      console.info('书封暂时使用馆藏占位设计。', error.message);
    }
    await new Promise(resolve => setTimeout(resolve, 1100));
  }
}

renderThemes();
renderHero();
renderShelf();
hydrateCovers();

$('#moodInput').addEventListener('input', () => $('#charCount').textContent = `${$('#moodInput').value.length} / 500`);
$('#moodInput').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') showAnswer(); });
$('#submitBtn').addEventListener('click', showAnswer);
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => {
  $('#moodInput').value = button.dataset.prompt;
  $('#moodInput').dispatchEvent(new Event('input'));
  $('#moodInput').focus();
}));
$('#bookSearch').addEventListener('input', () => { activeTheme = ''; renderShelf(true); });
$('#loadMore').addEventListener('click', () => { visibleLimit += 12; renderShelf(); });
$('#themeCloud').addEventListener('click', e => {
  const button = e.target.closest('[data-theme]');
  if (!button) return;
  activeTheme = button.dataset.theme;
  $('#bookSearch').value = '';
  visibleLimit = 100;
  renderShelf();
  $('#shelf').scrollIntoView({behavior:'smooth'});
});
document.addEventListener('click', e => {
  const target = e.target.closest('[data-book]');
  if (target) openBook(target.dataset.book, target);
});
$('#modalClose').addEventListener('click', () => closeBook());
$('#modalBack').addEventListener('click', () => closeBook());
$('#modalBackToShelf').addEventListener('click', () => closeBook());
$('#modalBackdrop').addEventListener('click', () => closeBook());
$('#modalContinue').addEventListener('click', () => $('#modalSummary').scrollIntoView({behavior:'smooth', block:'start'}));
$('#modalPrev').addEventListener('click', () => openBook(activeModalBookNumber <= 1 ? BOOKS.length : activeModalBookNumber - 1));
$('#modalNext').addEventListener('click', () => openBook(activeModalBookNumber >= BOOKS.length ? 1 : activeModalBookNumber + 1));
$('#modalThemeChips').addEventListener('click', event => {
  const chip = event.target.closest('[data-modal-theme]');
  if (!chip) return;
  activeTheme = chip.dataset.modalTheme;
  $('#bookSearch').value = '';
  visibleLimit = 100;
  renderShelf();
  closeBook();
  setTimeout(() => $('#shelf').scrollIntoView({behavior:'smooth'}), 120);
});
$('#bookModal').addEventListener('scroll', event => {
  const modal = event.currentTarget;
  const maximum = modal.scrollHeight - modal.clientHeight;
  $('#modalProgress').style.width = `${maximum > 0 ? Math.min(100, modal.scrollTop / maximum * 100) : 0}%`;
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeBook(); });
window.addEventListener('popstate', () => {
  if (!$('#bookModal').hidden) closeBook(true);
});
$('#againBtn').addEventListener('click', () => {
  $('#moodInput').focus();
  $('#talk').scrollIntoView({behavior:'smooth'});
});

const bgm = $('#bgm');
const musicPlayer = $('#musicPlayer');
const soundToggle = $('#soundToggle');
const playerToggle = $('#playerToggle');
const musicSeek = $('#musicSeek');
const musicVolume = $('#musicVolume');

bgm.volume = Number(musicVolume.value);

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function syncMusicUI() {
  const playing = !bgm.paused;
  musicPlayer.classList.toggle('playing', playing);
  soundToggle.classList.toggle('playing', playing);
  $('#soundLabel').textContent = playing ? '音乐播放中' : '播放音乐';
  playerToggle.textContent = playing ? 'Ⅱ' : '▶';
  playerToggle.setAttribute('aria-label', playing ? '暂停背景音乐' : '播放背景音乐');
  soundToggle.setAttribute('aria-label', playing ? '暂停背景音乐' : '播放背景音乐');
}

async function toggleMusic() {
  musicPlayer.classList.add('visible');
  if (bgm.paused) {
    try { await bgm.play(); } catch {}
  } else {
    bgm.pause();
  }
  syncMusicUI();
}

soundToggle.addEventListener('click', toggleMusic);
playerToggle.addEventListener('click', toggleMusic);
bgm.addEventListener('play', syncMusicUI);
bgm.addEventListener('pause', syncMusicUI);
bgm.addEventListener('timeupdate', () => {
  if (Number.isFinite(bgm.duration) && bgm.duration > 0) musicSeek.value = (bgm.currentTime / bgm.duration) * 100;
  $('#musicTime').textContent = `${formatTime(bgm.currentTime)} / ${formatTime(bgm.duration)}`;
});
bgm.addEventListener('loadedmetadata', () => {
  $('#musicTime').textContent = `0:00 / ${formatTime(bgm.duration)}`;
});
musicSeek.addEventListener('input', () => {
  if (Number.isFinite(bgm.duration)) bgm.currentTime = (Number(musicSeek.value) / 100) * bgm.duration;
});
musicVolume.addEventListener('input', () => { bgm.volume = Number(musicVolume.value); });

// Entrance progress, scroll reveals, and the spatial book constellation.
let loaderProgress = 0;
const loaderTimer = setInterval(() => {
  loaderProgress = Math.min(92, loaderProgress + Math.ceil(Math.random() * 8));
  $('#loaderCount').textContent = String(loaderProgress).padStart(3,'0');
  $('#loaderBar').style.width = `${loaderProgress}%`;
}, 90);
function finishLoader() {
  clearInterval(loaderTimer);
  loaderProgress = 100;
  $('#loaderCount').textContent = '100';
  $('#loaderBar').style.width = '100%';
  setTimeout(() => $('#siteLoader').classList.add('done'), 280);
}
window.addEventListener('load', () => setTimeout(finishLoader, 420), {once:true});
setTimeout(finishLoader, 1200);

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('revealed'); });
}, {threshold:.16});
document.querySelectorAll('[data-reveal]').forEach(el => revealObserver.observe(el));

const heroStage = $('#heroStage');
if (heroStage) {
  heroStage.addEventListener('pointermove', e => {
    const rect = heroStage.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - .5;
    const y = (e.clientY - rect.top) / rect.height - .5;
    $('#heroCovers').style.transform = `rotateY(${x * 5}deg) rotateX(${-y * 4}deg) translate(${x * 9}px,${y * 7}px)`;
  });
  heroStage.addEventListener('pointerleave', () => $('#heroCovers').style.transform = '');
}

if (matchMedia('(pointer:fine)').matches) {
  const cursor = $('#cursorOrb');
  document.addEventListener('mousemove', e => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  });
  document.addEventListener('mouseover', e => cursor.classList.toggle('hover', Boolean(e.target.closest('a,button,input,textarea'))));
}
