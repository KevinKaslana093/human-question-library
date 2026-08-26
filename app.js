const $ = selector => document.querySelector(selector);
const bookByN = n => BOOKS.find(book => book.n === Number(n));
const themeById = id => THEMES.find(theme => theme.id === id);
const normalize = value => (value || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
const hashText = text => [...text].reduce((sum, ch) => ((sum << 5) - sum + ch.charCodeAt(0)) | 0, 0) >>> 0;
const pick = (items, seed = 0) => items[seed % items.length];
const escapeHTML = value => String(value || '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

let visibleLimit = 12;
let activeTheme = '';
let selectedIntent = 'auto';
let currentAnswerRecord = null;
let questionThread = [];
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

const EXPERIENCE_BRANCHES = [
  {id:'self', label:'自己', en:'SELF', domains:['self','emotion'], description:'身份、成长、羞耻、勇气与那些只有自己听见的声音。', x:18, y:24},
  {id:'others', label:'他人', en:'OTHERS', domains:['connect','love'], description:'陪伴、亲密、冲突、合作，以及我们如何靠近又如何分开。', x:50, y:12},
  {id:'body', label:'身体', en:'BODY', domains:['body'], description:'欲望、边界、健康、休息，以及身体比语言更早知道的事。', x:82, y:24},
  {id:'world', label:'世界', en:'WORLD', domains:['society'], description:'权力、工作、正义、群体，以及个人问题背后的共同结构。', x:82, y:72},
  {id:'time', label:'时间', en:'TIME', domains:['create','world'], description:'创造、变化、未来、记忆，以及我们怎样与尚未发生之事相处。', x:50, y:86},
  {id:'unknown', label:'未知', en:'UNKNOWN', domains:['mind','existence'], description:'好奇、真理、意义、死亡，以及那些不会一次回答完的问题。', x:18, y:72}
];

const INTENTS = {
  comfort:{label:'先被接住', title:'先别急着解决，先让这件事有一个被安放的位置。'},
  understand:{label:'想明白', title:'你在问的，也许不只是表面上的那个问题。'},
  decide:{label:'做决定', title:'真正困难的不是选项，而是每个选项会让你成为什么人。'},
  action:{label:'往前一步', title:'不需要一次改变全部，先找到能够发生的最小一步。'},
  explore:{label:'自由探索', title:'有些问题不急着有用，它们只是想把世界再打开一点。'}
};

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

function renderThemes(initialBranch = 'self') {
  const roots = $('#experienceRoots');
  const lines = $('#neuralLines');
  roots.innerHTML = EXPERIENCE_BRANCHES.map((branch, index) => `
    <button class="experience-root" data-branch="${branch.id}" style="--x:${branch.x}%;--y:${branch.y}%;--delay:${index * .11}s">
      <small>${branch.en}</small><strong>${branch.label}</strong>
    </button>`).join('');
  lines.innerHTML = EXPERIENCE_BRANCHES.map(branch => {
    const controlX = (50 + branch.x) / 2 + (branch.y > 50 ? 4 : -4);
    const controlY = (49 + branch.y) / 2;
    return `<path data-line="${branch.id}" d="M 50 49 Q ${controlX} ${controlY} ${branch.x} ${branch.y}" />`;
  }).join('');

  const draw = branchId => {
    const branch = EXPERIENCE_BRANCHES.find(item => item.id === branchId);
    const list = branch ? THEMES.filter(theme => branch.domains.includes(theme.domain)) : THEMES;
    roots.querySelectorAll('button').forEach(button => button.classList.toggle('active', button.dataset.branch === branchId));
    lines.querySelectorAll('path').forEach(path => path.classList.toggle('active', path.dataset.line === branchId));
    $('#experienceCore').classList.toggle('active', !branch);
    $('#branchReadout').innerHTML = branch
      ? `<span>${String(list.length).padStart(2,'0')} 个节点正在生长</span><h3>${branch.label}</h3><p>${branch.description}</p>`
      : `<span>全部节点已展开</span><h3>一百种人类经验</h3><p>它们不是一百个彼此孤立的抽屉，而是一张会互相牵动的网络。</p>`;
    $('#themeCloud').innerHTML = list.map((theme, index) => `
      <button data-theme="${theme.id}" style="--leaf-delay:${Math.min(index, 20) * .035}s">
        <span>${String(theme.index).padStart(2,'0')}</span><strong>${theme.label}</strong><small>${theme.line}</small>
      </button>`).join('');
  };

  roots.addEventListener('click', event => {
    const root = event.target.closest('[data-branch]');
    if (root) {
      const map = $('#experienceMap');
      map.classList.remove('refocusing');
      void map.offsetWidth;
      map.classList.add('refocusing');
      setTimeout(() => map.classList.remove('refocusing'), 760);
      draw(root.dataset.branch);
    }
  });
  $('#experienceCore').addEventListener('click', () => draw('all'));
  draw(initialBranch);
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
  const candidates = BOOKS.map(book => {
    let score = book.tags.reduce((sum, tag) => sum + (ids.includes(tag) ? 9 - ids.indexOf(tag) * 2 : 0), 0);
    score += ((seed + book.n * 17) % 19) / 20;
    return {book, score};
  });
  const selected = [];
  while (selected.length < limit && candidates.length) {
    candidates.forEach(candidate => {
      const overlap = selected.reduce((sum, chosen) => sum + candidate.book.tags.filter(tag => chosen.tags.includes(tag)).length, 0);
      candidate.adjusted = candidate.score - overlap * 1.2;
    });
    candidates.sort((a,b) => b.adjusted - a.adjusted);
    selected.push(candidates.shift().book);
  }
  return selected;
}

function detectIntent(text) {
  if (selectedIntent !== 'auto') return selectedIntent;
  const rules = [
    ['decide', /(要不要|该不该|选择哪|选哪个|做决定|两难|还是.{0,12}(好|更好|合适))/],
    ['comfort', /(我.{0,10}(难过|痛苦|委屈|孤独|崩溃|被抛弃|失去|害怕|焦虑|撑不住|伤心|想哭|很糟)|朋友.{0,8}(离开|抛弃)|没人.{0,6}(理解|陪|在乎))/],
    ['action', /(如何|怎么做|开始|行动|改变|完成|坚持|计划|拖延)/],
    ['understand', /(为什么|怎么回事|本质|原因|理解|想明白|意味着什么|到底)/],
    ['explore', /(无聊|随便|好奇|看看|有意思|不知道问什么)/]
  ];
  return rules.find(([,pattern]) => pattern.test(text))?.[0] || 'understand';
}

function buildTension(intent, themes) {
  const first = themes[0]?.label || '在意的事';
  const second = themes[1]?.label || '安全感';
  const templates = {
    comfort:`一部分的你正在经历「${first}」，另一部分可能又要求自己赶快恢复正常。真正消耗人的，常常正是感受与自我要求同时发生。`,
    understand:`表面上你在追问「${first}」，更深处却可能同时牵动「${second}」。如果只回答其中一个，问题仍会从另一个方向回来。`,
    decide:`你并不只是比较两个选项，也在衡量「${first}」与「${second}」哪一个更值得由现在的你承担。`,
    action:`你已经知道一些方向，卡住你的可能不是意愿，而是把「${first}」变成行动时，仍想一次照顾好「${second}」。`,
    explore:`你的问题暂时不需要被收束。它正在「${first}」与「${second}」之间建立一条以前没有的连接。`
  };
  return templates[intent];
}

function buildNextQuestion(intent, themes) {
  const first = themes[0]?.label || '这件事';
  const questions = {
    comfort:`如果暂时不用证明自己没事，你最希望谁能够理解你关于「${first}」的哪一部分？`,
    understand:`如果把所有“应该”拿掉，你真正想弄明白的究竟是哪一个为什么？`,
    decide:`一年后的你回头看，会更遗憾做错了，还是从来没有认真选择过？`,
    action:`哪一个小到不会吓退你的动作，能够在十分钟之内证明事情已经开始？`,
    explore:`这个问题最让你好奇的部分，是答案本身，还是追问时出现的那个自己？`
  };
  return questions[intent];
}

function bookAngle(book, response, index) {
  const matches = book.tags.filter(tag => response.themes.some(theme => theme.id === tag)).map(displayTag);
  const subject = matches.length ? `「${matches.slice(0,2).join('」与「')}」` : '另一个观察位置';
  const frames = [
    `第一面镜子：用${subject}重新描述问题，而不是急着给它下结论。`,
    `第二面镜子：从${subject}挑战你现在最熟悉的解释。`,
    `第三面镜子：把${subject}带回一个可以尝试的现实动作。`
  ];
  return frames[index];
}

function buildResponse(text, previousQuestion = '') {
  const analysisText = previousQuestion ? `${previousQuestion} ${text}` : text;
  if (CRISIS_WORDS.some(word => analysisText.includes(word))) {
    const safetyTheme = themeById('hope');
    return {
      themes:[safetyTheme],
      intent:'comfort', intentLabel:'需要现实支持',
      title:'先不要一个人扛，也先不要做任何伤害自己的决定。',
      body:'你说出的这些话值得被认真对待。这个网页不能替代现实中的帮助：请现在就联系一个你信任的人，让对方来陪你，或陪你去见医生、心理专业人员。如果你觉得自己可能马上伤害自己，请立刻联系当地急救服务或危机援助热线，并远离可能伤害自己的物品。',
      tension:'现在最重要的不是解释问题，而是让你从独自承受转向有人在场、有人知道、有人能够提供现实帮助。',
      question:'此刻有哪一个人，是你可以马上拨通电话或发出求助消息的？',
      action:'现在就把这句话发给一个可信的人：“我现在不安全，需要你来陪我，并帮我联系专业支持。”',
      books:recommendBooks([safetyTheme, themeById('meaning')], analysisText)
    };
  }

  let themes = scoreThemes(analysisText);
  const countIntent = /(多少本|几本书|书多|馆藏|有多少)/.test(analysisText);
  if (countIntent && !themes.some(t => t.id === 'curiosity')) themes.unshift(themeById('curiosity'));
  if (!themes.length) themes = [themeById('curiosity'), themeById('meaning')];
  themes = themes.slice(0, 3);
  const primary = themes[0];
  const seed = hashText(analysisText);
  const intent = detectIntent(analysisText);
  const intentInfo = INTENTS[intent];
  const title = countIntent
    ? `你怎么这么好奇呢？这里现在刚好有 ${BOOKS.length} 本书。`
    : intentInfo.title;
  const opener = pick(DOMAIN_RESPONSES[primary.domain], seed);
  const blend = themes.length > 1
    ? `这句话里同时出现了「${themes.map(t => t.label).join('」「')}」。它们放在一起，说明你的问题不属于一个单独的抽屉。`
    : '这个问题可以先被认真看见，不必立刻被压缩成一个标准答案。';
  const echo = text.length > 72 ? `${text.slice(0,72)}……` : text;
  return {
    themes,
    intent, intentLabel:intentInfo.label,
    title,
    body:`${previousQuestion ? '沿着刚才的问题，你又往下问了一层。' : ''}你写下的是：“${echo}” ${opener}${countIntent ? ` 这一百本书横跨十个知识区域，但数量并不是最重要的。` : ''}${blend}`,
    tension:buildTension(intent, themes),
    question:buildNextQuestion(intent, themes),
    action:ACTIONS[primary.domain],
    books:recommendBooks(themes, analysisText),
  };
}

function renderQuestionThread() {
  const thread = $('#followupThread');
  if (!thread) return;
  thread.innerHTML = questionThread.map((question,index) => `<div class="thread-node"><small>${String(index + 1).padStart(2,'0')} / ${index ? '继续追问' : '最初的问题'}</small>${escapeHTML(question)}</div>`).join('');
  thread.scrollTop = thread.scrollHeight;
}

async function showAnswer(source) {
  const input = $('#moodInput');
  const isFollowup = typeof source === 'string';
  const text = (isFollowup ? source : input.value).trim();
  if (!text) {
    const targetInput = isFollowup ? $('#followupInput') : input;
    targetInput.focus();
    targetInput.placeholder = '哪怕只写“为什么”也可以。';
    targetInput.closest(isFollowup ? '.followup-input' : '.input-card')?.animate([{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}], {duration:260});
    return;
  }
  const previousQuestion = isFollowup ? currentAnswerRecord?.questionText || '' : '';
  if (isFollowup) questionThread.push(text);
  else questionThread = [text];
  const button = isFollowup ? $('#followupSubmit') : $('#submitBtn');
  button.classList.add('loading');
  if (isFollowup) button.firstChild.textContent = '正在沿路径继续… ';
  else button.querySelector('span:first-child').textContent = '正在穿过一百本书…';
  setTimeout(async () => {
    const response = buildResponse(text, previousQuestion);
    currentAnswerRecord = {...response, questionText:text, thread:[...questionThread], createdAt:new Date().toISOString()};
    const coverWork = Promise.all(response.books.map(async book => { await resolveOneCover(book); await preloadCover(book, 'small'); }));
    $('#moodTag').textContent = response.themes.map(t => t.label).join(' × ');
    $('#answerIntent').textContent = `你需要的是：${response.intentLabel}`;
    $('#questionPath').innerHTML = `<span class="path-node">你的问题</span><span class="path-line"></span><span class="path-node">${response.intentLabel}</span>` + response.themes.map(theme => `<span class="path-line"></span><span class="path-node">${theme.label}</span>`).join('') + `<span class="path-line"></span><span class="path-node">三种视角</span>`;
    $('#answerTitle').textContent = response.title;
    $('#answerText').textContent = response.body;
    $('#answerTension').textContent = response.tension;
    $('#answerQuestion').textContent = response.question;
    $('#smallStep').innerHTML = `<strong>今天可以做的一件小事</strong><span>${response.action}</span>`;
    $('#inspiredBooks').innerHTML = response.books.map((book, index) => `
      <button class="mini-book" data-book="${book.n}">
        <span class="mini-cover">${coverMarkup(book, 'small')}</span>
        <span><small class="source-badge">思想转述 / ${String(index + 1).padStart(2,'0')}</small><strong>《${book.zh}》</strong><span class="book-angle">${bookAngle(book, response, index)}</span><em>${book.tags.filter(t => response.themes.some(x => x.id === t)).map(displayTag).join(' · ') || '换一个观察位置'}</em></span>
      </button>`).join('');
    coverWork.then(() => {
      if (currentAnswerRecord?.questionText !== text) return;
      response.books.forEach(book => {
        const cover = $(`#inspiredBooks [data-book="${book.n}"] .mini-cover`);
        if (cover) cover.innerHTML = coverMarkup(book, 'small');
      });
    });
    $('#answer').hidden = false;
    $('#noteScene').hidden = false;
    $('#noteQuestion').textContent = text;
    $('#noteTitle').textContent = response.title;
    $('#noteBody').textContent = response.tension;
    $('#notePrompt').textContent = response.question;
    $('#noteStepText').textContent = response.action;
    $('#noteDate').textContent = new Intl.DateTimeFormat('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    $('#noteSerial').textContent = String(hashText(text) % 1000).padStart(3,'0');
    $('#noteRouteNodes').innerHTML = [`需要：${response.intentLabel}`,...response.themes.map(theme => theme.label),'三本书的视角'].map((label,index,array) => `<span>${label}</span>${index < array.length - 1 ? '<i></i>' : ''}`).join('');
    renderQuestionThread();
    $('#noteBooks').innerHTML = response.books.map(book => `<button data-book="${book.n}">《${book.zh}》</button>`).join('');
    $('#answer').classList.remove('reveal');
    void $('#answer').offsetWidth;
    $('#answer').classList.add('reveal');
    button.classList.remove('loading');
    if (isFollowup) {
      button.firstChild.textContent = '继续向下问 ';
      $('#followupInput').value = '';
      $('#followupCount').textContent = '0 / 300';
    } else button.querySelector('span:first-child').textContent = '让一百本书回答';
    $('#saveToast').textContent = '';
    document.body.classList.add('answer-arriving','note-developing');
    cinematicScroll($('#noteScene'), 'DEVELOPING YOUR QUESTION NOTE', true);
    setTimeout(() => document.body.classList.remove('answer-arriving','note-developing'), 1800);
  }, 620);
}

let modalHistoryActive = false;
let activeModalBookNumber = 1;
let lastBookSourceElement = null;

async function openBook(n, sourceElement) {
  const book = bookByN(n);
  lastBookSourceElement = sourceElement || null;
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
  $('#modalQuote').textContent = mainTheme?.line || '一本书不会替你结束问题，但会改变你提问的位置。';
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
    document.body.classList.add('book-focus');
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
  if ($('#bookModal').hidden) return;
  const modalMedia = $('.modal-cover-shell img');
  const sourceMedia = lastBookSourceElement?.querySelector('img');
  const transitionName = `book-cover-return-${activeModalBookNumber}`;
  const hideModal = () => {
    if (modalMedia) modalMedia.style.viewTransitionName = '';
    if (sourceMedia) sourceMedia.style.viewTransitionName = transitionName;
    $('#bookModal').hidden = true;
    $('#bookModal').scrollTop = 0;
    document.body.classList.remove('book-focus');
    document.body.style.overflow = '';
    if (modalHistoryActive && !fromHistory) {
      modalHistoryActive = false;
      history.back();
    } else if (fromHistory) {
      modalHistoryActive = false;
    }
  };
  if (document.startViewTransition && modalMedia && sourceMedia) {
    modalMedia.style.viewTransitionName = transitionName;
    const transition = document.startViewTransition(hideModal);
    transition.finished.finally(() => {
      sourceMedia.style.viewTransitionName = '';
      lastBookSourceElement = null;
    });
  } else {
    hideModal();
    if (sourceMedia) sourceMedia.style.viewTransitionName = '';
    lastBookSourceElement = null;
  }
}

function getNotes() {
  try { return JSON.parse(localStorage.getItem('human-library-notes-v1') || '[]'); }
  catch { return []; }
}

function setNotes(notes) {
  localStorage.setItem('human-library-notes-v1', JSON.stringify(notes));
  renderNotes();
}

function renderNotes() {
  const notes = getNotes();
  $('#notesCount').textContent = notes.length;
  $('#notesList').innerHTML = notes.length ? notes.map(note => `
    <article class="saved-note" data-note-id="${note.id}">
      <div class="saved-note-meta"><span>${escapeHTML(note.intentLabel)}</span><time>${new Date(note.createdAt).toLocaleDateString('zh-CN')}</time></div>
      <h3>${escapeHTML(note.question)}</h3>
      <p>${escapeHTML(note.title)}</p>
      <div class="saved-note-tags">${note.themes.map(theme => `<span>${escapeHTML(theme)}</span>`).join('')}</div>
      <div class="saved-note-actions"><button data-note-open="${note.id}">继续这个问题</button><button data-note-delete="${note.id}" aria-label="删除这条札记">删除</button></div>
    </article>`).join('') : `<div class="notes-empty"><span>○</span><h3>还没有留下问题</h3><p>当一封回信值得以后再看，点击“保存这次问题”。</p></div>`;
  $('#notesClear').hidden = !notes.length;
  renderTrail();
}

function saveCurrentNote() {
  if (!currentAnswerRecord) return;
  const notes = getNotes();
  const note = {
    id:String(hashText(currentAnswerRecord.questionText + Date.now())),
    question:currentAnswerRecord.questionText,
    title:currentAnswerRecord.title,
    intent:currentAnswerRecord.intent,
    intentLabel:currentAnswerRecord.intentLabel,
    themes:currentAnswerRecord.themes.map(theme => theme.label),
    action:currentAnswerRecord.action,
    books:currentAnswerRecord.books.map(book => book.n),
    thread:currentAnswerRecord.thread || [currentAnswerRecord.questionText],
    createdAt:new Date().toISOString()
  };
  setNotes([note, ...notes.filter(item => item.question !== note.question)].slice(0, 30));
  $('#saveToast').textContent = '已经放进“我的问题札记”，它只保存在这台设备上。';
  if ($('#noteToast')) $('#noteToast').textContent = '已经留下。这张札记只保存在你的浏览器里。';
}

function shareCurrentNote() {
  if (!currentAnswerRecord) return;
  const text = `人类问题图书馆｜我的问题札记\n\n${currentAnswerRecord.questionText}\n\n${currentAnswerRecord.title}\n${currentAnswerRecord.tension}\n\n今天的一步：${currentAnswerRecord.action}\n\n延伸阅读：${currentAnswerRecord.books.map(book => `《${book.zh}》`).join('、')}\nhttps://kevinkaslana093.github.io/human-question-library/`;
  const done = () => {
    $('#saveToast').textContent = '分享札记已经复制，可以发给你想分享的人。';
    if ($('#noteToast')) $('#noteToast').textContent = '已经复制成一段可以分享的文字。';
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  else fallbackCopy(text, done);
}

function fallbackCopy(text, done) {
  const input = document.createElement('textarea');
  input.value = text;
  input.style.position = 'fixed'; input.style.opacity = '0';
  document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove(); done();
}

function renderTrail() {
  if (!$('#trailPlanets')) return;
  const notes = getNotes();
  const counts = new Map();
  notes.forEach(note => (note.themes || []).forEach(theme => counts.set(theme,(counts.get(theme) || 0) + 1)));
  const ranked = [...counts.entries()].sort((a,b) => b[1] - a[1]).slice(0,8);
  const maximum = ranked[0]?.[1] || 1;
  const positions = [[50,13],[77,22],[89,49],[77,77],[50,87],[23,77],[11,49],[23,22]];
  $('#trailTotal').textContent = notes.length;
  $('#trailPlanets').innerHTML = ranked.map(([theme,count],index) => {
    const [x,y] = positions[index];
    const size = 58 + Math.round(count / maximum * 38);
    return `<div class="trail-planet ${index===0?'dominant':''}" style="--x:${x}%;--y:${y}%;--size:${size}px;--delay:${index*-.43}s"><strong>${escapeHTML(theme)}</strong><small>${count} 次</small></div>`;
  }).join('');
  if (ranked.length) {
    const [first,firstCount] = ranked[0];
    const second = ranked[1]?.[0];
    $('#trailTitle').textContent = second ? `你最近总在「${first}」与「${second}」之间往返。` : `「${first}」正在成为你反复靠近的主题。`;
    $('#trailInsight').textContent = `它出现了 ${firstCount} 次。这不是对你的定义，只是提醒：有些问题会换一种说法回来，而你每次回来时都已经不同。`;
  } else {
    $('#trailTitle').textContent = '你的星图还在等待第一个问题。';
    $('#trailInsight').textContent = '保存一张札记后，这里会显示你反复靠近的主题，而不是给你贴上固定标签。';
  }
  $('#trailBars').innerHTML = ranked.slice(0,5).map(([theme,count]) => `<div class="trail-bar"><span>${escapeHTML(theme)}</span><i style="--ratio:${count/maximum}"></i><b>${count}</b></div>`).join('');
  $('#trailTimeline').innerHTML = notes.length ? notes.slice(0,4).map(note => `<button class="trail-memory" data-trail-question="${escapeHTML(note.question)}"><small>${new Date(note.createdAt).toLocaleDateString('zh-CN')} · ${escapeHTML(note.intentLabel)}</small><p>${escapeHTML(note.question)}</p><span>${(note.themes || []).map(escapeHTML).join(' · ')}</span></button>`).join('') : '<div class="trail-empty">当你留下一张札记，第一颗星会在这里亮起。</div>';
}

function wrapCanvasText(context, text, x, y, maxWidth, lineHeight, maxLines) {
  const chars = [...String(text || '')];
  const lines = [];
  let line = '';
  chars.forEach(char => {
    const test = line + char;
    if (context.measureText(test).width > maxWidth && line) { lines.push(line); line = char; }
    else line = test;
  });
  if (line) lines.push(line);
  const visible = lines.slice(0,maxLines);
  if (lines.length > maxLines) visible[maxLines-1] = `${visible[maxLines-1].slice(0,-1)}…`;
  visible.forEach((value,index) => context.fillText(value,x,y+index*lineHeight));
  return y + visible.length * lineHeight;
}

async function generateShareImage() {
  if (!currentAnswerRecord) return;
  document.body.classList.add('exporting-note');
  $('#noteToast').textContent = '正在把这张札记定影…';
  try { await document.fonts?.ready; } catch {}
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  const context = canvas.getContext('2d');
  context.fillStyle = '#eee9df'; context.fillRect(0,0,1080,1350);
  context.strokeStyle = 'rgba(32,38,32,.18)'; context.lineWidth = 2; context.strokeRect(38,38,1004,1274);
  context.fillStyle = '#20251f'; context.font = '500 22px "Noto Serif SC",serif'; context.fillText('人类问题图书馆',82,102);
  context.textAlign = 'right'; context.fillStyle = '#9a4b38'; context.font = '18px sans-serif'; context.fillText(`QUESTION NOTE / ${String(hashText(currentAnswerRecord.questionText)%1000).padStart(3,'0')}`,998,102); context.textAlign='left';
  context.fillStyle = '#a64732'; context.fillRect(82,148,88,4);
  context.fillStyle = '#777c74'; context.font = '18px "Noto Serif SC",serif'; context.fillText('我带来的问题',82,206);
  context.fillStyle = '#252a24'; context.font = '500 34px "Noto Serif SC",serif'; let y = wrapCanvasText(context,currentAnswerRecord.questionText,82,258,916,52,3);
  y += 46; context.fillStyle='#a64732'; context.font='18px sans-serif'; context.fillText('A LETTER FROM ONE HUNDRED BOOKS',82,y); y += 64;
  context.fillStyle='#20251f'; context.font='500 56px "Noto Serif SC",serif'; y=wrapCanvasText(context,currentAnswerRecord.title,82,y,916,78,4)+34;
  context.fillStyle='#60665e'; context.font='24px "Noto Serif SC",serif'; y=wrapCanvasText(context,currentAnswerRecord.tension,82,y,916,42,5)+36;
  context.strokeStyle='rgba(32,38,32,.16)'; context.beginPath();context.moveTo(82,y);context.lineTo(998,y);context.stroke(); y+=48;
  context.fillStyle='#888d85';context.font='17px sans-serif';context.fillText('留给明天的一个问题',82,y); y+=42;
  context.fillStyle='#252a24';context.font='25px "Noto Serif SC",serif';y=wrapCanvasText(context,currentAnswerRecord.question,82,y,916,42,3)+36;
  context.fillStyle='#888d85';context.font='17px sans-serif';context.fillText('今天的一小步',82,y);y+=42;
  context.fillStyle='#c04e36';context.font='25px "Noto Serif SC",serif';wrapCanvasText(context,currentAnswerRecord.action,82,y,916,42,3);
  context.fillStyle='#747970';context.font='18px "Noto Serif SC",serif';context.fillText(`思想来源：${currentAnswerRecord.books.map(book=>`《${book.zh}》`).join(' · ')}`,82,1250);
  context.textAlign='right';context.font='16px sans-serif';context.fillText('human-question-library',998,1292);
  const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
  if (!blob) throw new Error('image export failed');
  window.__lastExportBlobSize = blob.size;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href=url; link.download=`人类问题札记-${new Date().toISOString().slice(0,10)}.png`; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  $('#noteToast').textContent = '分享图片已经生成，可以把它带走了。';
  setTimeout(()=>document.body.classList.remove('exporting-note'),800);
}

function openNotes() {
  renderNotes();
  $('#notesDrawer').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#notesClose').focus();
}

function closeNotes() {
  $('#notesDrawer').hidden = true;
  document.body.style.overflow = '';
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
renderNotes();
hydrateCovers();

$('#moodInput').addEventListener('input', () => $('#charCount').textContent = `${$('#moodInput').value.length} / 500`);
$('#moodInput').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') showAnswer(); });
$('#submitBtn').addEventListener('click', showAnswer);
$('#intentPicker').addEventListener('click', event => {
  const button = event.target.closest('[data-intent]');
  if (!button) return;
  selectedIntent = button.dataset.intent;
  $('#intentPicker').querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
});
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => {
  $('#moodInput').value = button.dataset.prompt;
  $('#moodInput').dispatchEvent(new Event('input'));
  $('#moodInput').focus();
}));
const LIBRARY_QUESTIONS = [
  '你最近一次改变看法，是因为事实，还是因为终于愿意承认自己变了？',
  '如果没有人会评价，你现在最想认真学习的东西是什么？',
  '你正在坚持的事情里，有多少是热爱，又有多少只是舍不得已经付出的代价？',
  '哪一种关系让你更像自己，而不是更擅长扮演自己？',
  '你上一次感到真正自由时，身边有什么，又没有什么？',
  '假如失败不会被任何人看见，你还会害怕开始吗？',
  '你对未来的担心，究竟在保护现在的哪一部分？',
  '有什么愿望，你总是用“以后再说”来温柔地拒绝？',
  '当你说自己无聊时，你是在缺少刺激，还是缺少连接？',
  '如果今天只允许完成一件重要的事，它应该是什么？',
  '你最想被别人理解的地方，自己真的理解了吗？',
  '此刻的你，需要的是答案、陪伴、行动，还是一次允许？'
];
let drawnQuestionIndex = 0;
$('#drawQuestion').addEventListener('click', () => {
  const deck = $('#questionDeck');
  let next = drawnQuestionIndex;
  while (next === drawnQuestionIndex && LIBRARY_QUESTIONS.length > 1) next = Math.floor(Math.random() * LIBRARY_QUESTIONS.length);
  drawnQuestionIndex = next;
  deck.classList.remove('drawing');
  void deck.offsetWidth;
  deck.classList.add('drawing');
  setTimeout(() => {
    $('#drawnQuestion').textContent = LIBRARY_QUESTIONS[drawnQuestionIndex];
    $('#drawCount').textContent = String(drawnQuestionIndex + 1).padStart(2,'0');
  }, 260);
  setTimeout(() => deck.classList.remove('drawing'), 700);
});
$('#answerDrawn').addEventListener('click', () => {
  $('#moodInput').value = $('#drawnQuestion').textContent;
  $('#moodInput').dispatchEvent(new Event('input'));
  cinematicScroll($('#talk'), 'CARRYING THE QUESTION TO THE TERMINAL');
  setTimeout(() => $('#moodInput').focus(), 800);
});
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
$('#saveNote').addEventListener('click', saveCurrentNote);
$('#shareNote').addEventListener('click', shareCurrentNote);
$('#noteSave').addEventListener('click', saveCurrentNote);
$('#noteShare').addEventListener('click', shareCurrentNote);
$('#noteImage').addEventListener('click', generateShareImage);
$('#noteSeeFull').addEventListener('click', () => cinematicScroll($('#answer'), 'OPENING THE FULL THOUGHT ROUTE'));
$('#noteAgain').addEventListener('click', () => {
  $('#moodInput').focus();
  cinematicScroll($('#talk'), 'RETURNING TO THE QUESTION TERMINAL');
});
$('#followupInput').addEventListener('input', event => $('#followupCount').textContent = `${event.target.value.length} / 300`);
$('#followupInput').addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') showAnswer(event.currentTarget.value);
});
$('#followupSubmit').addEventListener('click', () => showAnswer($('#followupInput').value));
$('#trailOpenNotes').addEventListener('click', openNotes);
$('#trailAskAgain').addEventListener('click', () => {
  const note = getNotes()[0];
  if (note) {
    $('#moodInput').value = note.question;
    $('#moodInput').dispatchEvent(new Event('input'));
  }
  cinematicScroll($('#talk'), note ? 'RETURNING TO AN OLD QUESTION' : 'BEGINNING YOUR FIRST QUESTION');
  setTimeout(() => $('#moodInput').focus(),800);
});
$('#trailTimeline').addEventListener('click', event => {
  const memory = event.target.closest('[data-trail-question]');
  if (!memory) return;
  $('#moodInput').value = memory.dataset.trailQuestion;
  $('#moodInput').dispatchEvent(new Event('input'));
  cinematicScroll($('#talk'), 'REOPENING A QUESTION');
  setTimeout(() => $('#moodInput').focus(),800);
});
$('#notesOpen').addEventListener('click', openNotes);
$('#notesClose').addEventListener('click', closeNotes);
$('#notesBackdrop').addEventListener('click', closeNotes);
$('#notesList').addEventListener('click', event => {
  const remove = event.target.closest('[data-note-delete]');
  if (remove) {
    setNotes(getNotes().filter(note => note.id !== remove.dataset.noteDelete));
    return;
  }
  const reopen = event.target.closest('[data-note-open]');
  if (!reopen) return;
  const note = getNotes().find(item => item.id === reopen.dataset.noteOpen);
  if (!note) return;
  $('#moodInput').value = note.question;
  $('#moodInput').dispatchEvent(new Event('input'));
  selectedIntent = note.intent || 'auto';
  $('#intentPicker').querySelectorAll('button').forEach(button => button.classList.toggle('active', button.dataset.intent === selectedIntent));
  closeNotes();
  $('#talk').scrollIntoView({behavior:'smooth'});
});
$('#notesClear').addEventListener('click', () => {
  if (confirm('确定清空当前浏览器里的全部问题札记吗？')) setNotes([]);
});
$('.answer-feedback').addEventListener('click', event => {
  const button = event.target.closest('[data-feedback]');
  if (!button) return;
  $('#saveToast').textContent = button.dataset.feedback === 'yes' ? '谢谢你告诉我。愿这条线索能陪你再往前一点。' : '收到。下一版会让“换一个角度”真正根据你的反馈重新回答。';
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#notesDrawer').hidden) closeNotes();
  else if (!$('#bookModal').hidden) closeBook();
});
window.addEventListener('popstate', () => {
  if (!$('#bookModal').hidden) closeBook(true);
});
$('#againBtn').addEventListener('click', () => {
  $('#moodInput').focus();
  cinematicScroll($('#talk'), 'RETURNING TO THE QUESTION TERMINAL');
});

const bgm = $('#bgm');
const musicPlayer = $('#musicPlayer');
const soundToggle = $('#soundToggle');
const playerToggle = $('#playerToggle');
const musicSeek = $('#musicSeek');
const musicVolume = $('#musicVolume');

bgm.volume = Number(musicVolume.value);

const entryGate = $('#entryGate');
let alreadyEntered = false;
try { alreadyEntered = sessionStorage.getItem('hql-entered-v7') === 'yes'; } catch {}
if (alreadyEntered) {
  entryGate.classList.add('leaving');
  entryGate.setAttribute('aria-hidden','true');
} else {
  document.body.classList.add('entry-open');
}

function finishEntry(withSound) {
  if (withSound) {
    musicPlayer.classList.add('visible');
    bgm.volume = Number(musicVolume.value);
    bgm.play().then(syncMusicUI).catch(syncMusicUI);
  }
  try { sessionStorage.setItem('hql-entered-v7','yes'); } catch {}
  entryGate.classList.add('leaving');
  entryGate.style.pointerEvents = 'none';
  entryGate.setAttribute('aria-hidden','true');
  document.body.classList.remove('entry-open');
  setTimeout(() => { entryGate.hidden = true; }, 900);
}

$('#enterWithSound').addEventListener('click', () => finishEntry(true));
$('#enterSilent').addEventListener('click', () => finishEntry(false));

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

// V6: one motion grammar for navigation, depth, light, and direct manipulation.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const cameraTransition = $('#cameraTransition');
let cameraBusy = false;

function cinematicScroll(target, label = 'MOVING THROUGH THE LIBRARY', updateHistory = true) {
  if (!target) return;
  if (reduceMotion) {
    target.scrollIntoView({behavior:'auto', block:'start'});
    if (updateHistory && target.id) history.pushState(null, '', `#${target.id}`);
    return;
  }
  if (cameraBusy) return;
  cameraBusy = true;
  cameraTransition.querySelector('i').textContent = label;
  document.body.style.setProperty('--camera-origin', `${innerHeight * .5}px`);
  document.body.classList.add('camera-moving');
  setTimeout(() => {
    const top = target.getBoundingClientRect().top + scrollY;
    window.scrollTo({top, behavior:'auto'});
    if (updateHistory && target.id) history.pushState(null, '', `#${target.id}`);
    target.classList.remove('camera-entering');
    void target.offsetWidth;
    target.classList.add('camera-entering');
  }, 260);
  setTimeout(() => {
    document.body.classList.remove('camera-moving');
    cameraBusy = false;
    setTimeout(() => target.classList.remove('camera-entering'), 1150);
  }, 760);
}

document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
  const target = document.querySelector(link.getAttribute('href'));
  if (!target) return;
  event.preventDefault();
  const labels = {talk:'ENTER QUESTION TERMINAL',noteScene:'DEVELOPING YOUR QUESTION NOTE',discover:'DRAW A QUESTION',themes:'ENTER THE EXPERIENCE TREE',shelf:'ENTER THE BOOK ORBIT',method:'HOW THE LIBRARY THINKS',trail:'ENTER YOUR QUESTION ORBIT',top:'RETURN TO THE BEGINNING'};
  cinematicScroll(target, labels[target.id] || 'MOVING THROUGH THE LIBRARY');
}));

const cameraSections = [...document.querySelectorAll('main > section')];
cameraSections.forEach(section => section.classList.add('camera-section'));
let lastScrollY = scrollY;
let scrollEnergy = 0;
let scrollFrame = 0;
let scrollBurstTimer = 0;

function updateCameraDepth() {
  scrollFrame = 0;
  const viewport = innerHeight;
  const maximum = Math.max(1, document.documentElement.scrollHeight - viewport);
  const progress = Math.min(1, Math.max(0, scrollY / maximum));
  document.documentElement.style.setProperty('--page-progress', `${progress * 100}%`);
  $('#motionMeter').style.height = `${progress * 100}%`;
  const scrollDelta = scrollY - lastScrollY;
  scrollEnergy = Math.min(55, Math.abs(scrollDelta) * .9 + scrollEnergy * .58);
  document.documentElement.style.setProperty('--scroll-energy', (scrollEnergy / 55).toFixed(3));
  document.documentElement.style.setProperty('--scroll-direction', scrollDelta >= 0 ? '1' : '-1');
  if (scrollEnergy > 10) {
    document.body.classList.add('scroll-burst');
    clearTimeout(scrollBurstTimer);
    scrollBurstTimer = setTimeout(() => {
      document.body.classList.remove('scroll-burst');
      document.documentElement.style.setProperty('--scroll-energy','0');
    }, 210);
  }
  lastScrollY = scrollY;
  cameraSections.forEach(section => {
    const rect = section.getBoundingClientRect();
    const relative = Math.max(-1.2, Math.min(1.2, (rect.top + rect.height * .5 - viewport * .5) / viewport));
    section.style.setProperty('--camera-shift', `${relative * -22}px`);
    section.style.setProperty('--camera-opacity', `${Math.max(.68, 1 - Math.abs(relative) * .12)}`);
  });
}

addEventListener('scroll', () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateCameraDepth);
}, {passive:true});
addEventListener('resize', updateCameraDepth);
updateCameraDepth();

if (!reduceMotion) {
  const canvas = $('#livingField');
  const context = canvas.getContext('2d');
  let fieldWidth = 0;
  let fieldHeight = 0;
  let fieldPointerX = .5;
  let fieldPointerY = .5;
  let fieldVisible = true;
  let strands = [];
  let particles = [];

  function resizeField() {
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    fieldWidth = innerWidth;
    fieldHeight = innerHeight;
    canvas.width = Math.round(fieldWidth * ratio);
    canvas.height = Math.round(fieldHeight * ratio);
    canvas.style.width = `${fieldWidth}px`;
    canvas.style.height = `${fieldHeight}px`;
    context.setTransform(ratio,0,0,ratio,0,0);
    const strandCount = fieldWidth < 700 ? 9 : 18;
    strands = Array.from({length:strandCount}, (_, index) => ({
      x:(index + .5) / strandCount,
      phase:Math.random() * Math.PI * 2,
      speed:.00012 + Math.random() * .00018,
      width:.55 + Math.random() * 1.65,
      alpha:.075 + Math.random() * .12
    }));
    const particleCount = fieldWidth < 700 ? 18 : 38;
    particles = Array.from({length:particleCount}, () => ({x:Math.random(),y:Math.random(),vx:(Math.random()-.5)*.00008,vy:(Math.random()-.5)*.00008,phase:Math.random()*6.28}));
  }

  function drawField(time) {
    if (!fieldVisible) { requestAnimationFrame(drawField); return; }
    context.clearRect(0,0,fieldWidth,fieldHeight);
    context.globalCompositeOperation = 'screen';
    const energy = Math.min(1, scrollEnergy / 35);
    scrollEnergy *= .94;
    const pointerGlow = context.createRadialGradient(fieldPointerX*fieldWidth,fieldPointerY*fieldHeight,0,fieldPointerX*fieldWidth,fieldPointerY*fieldHeight,Math.max(fieldWidth,fieldHeight)*.34);
    pointerGlow.addColorStop(0,`rgba(239,82,59,${.10 + energy*.14})`);
    pointerGlow.addColorStop(.35,`rgba(185,213,188,${.045 + energy*.05})`);
    pointerGlow.addColorStop(1,'rgba(0,0,0,0)');
    context.fillStyle = pointerGlow;
    context.fillRect(0,0,fieldWidth,fieldHeight);
    for (let ribbon=0;ribbon<3;ribbon++) {
      const center = fieldHeight * (.22 + ribbon * .29) + Math.sin(time*.00022 + ribbon*1.7)*70;
      const band = context.createLinearGradient(0,center-100,0,center+100);
      band.addColorStop(0,'rgba(0,0,0,0)');
      band.addColorStop(.5,`rgba(${ribbon===1?'239,82,59':'210,228,214'},${.035 + energy*.12})`);
      band.addColorStop(1,'rgba(0,0,0,0)');
      context.beginPath();
      context.moveTo(-40,center);
      for(let x=0;x<=fieldWidth+60;x+=80) context.lineTo(x,center+Math.sin(x*.006+time*.0005+ribbon)*45+energy*Math.sin(x*.02)*28);
      context.strokeStyle=band; context.lineWidth=70+energy*80; context.stroke();
    }
    strands.forEach((strand,index) => {
      const pulse = .5 + .5 * Math.sin(time * strand.speed + strand.phase);
      const baseX = strand.x * fieldWidth + (fieldPointerX - .5) * (18 + index);
      const gradient = context.createLinearGradient(0,0,0,fieldHeight);
      gradient.addColorStop(0,'rgba(255,255,255,0)');
      gradient.addColorStop(.25,`rgba(220,228,217,${strand.alpha * pulse})`);
      gradient.addColorStop(.62,`rgba(239,82,59,${strand.alpha * (1.2 + energy * 2)})`);
      gradient.addColorStop(1,'rgba(255,255,255,0)');
      context.beginPath();
      context.moveTo(baseX, -30);
      for (let y=0;y<=fieldHeight+40;y+=70) {
        const wave = Math.sin(y * .009 + time * strand.speed * 2 + strand.phase) * (8 + energy * 16);
        context.lineTo(baseX + wave, y);
      }
      context.strokeStyle = gradient;
      context.lineWidth = strand.width + energy * .8;
      context.stroke();
    });
    particles.forEach(particle => {
      particle.x = (particle.x + particle.vx * (1 + energy * 5) + 1) % 1;
      particle.y = (particle.y + particle.vy * (1 + energy * 5) + 1) % 1;
    });
    for (let i=0;i<particles.length;i++) {
      const a = particles[i];
      const ax = a.x * fieldWidth + (fieldPointerX-.5) * 24;
      const ay = a.y * fieldHeight + (fieldPointerY-.5) * 18;
      for (let j=i+1;j<particles.length;j++) {
        const b = particles[j];
        const bx = b.x * fieldWidth;
        const by = b.y * fieldHeight;
        const distance = Math.hypot(ax-bx,ay-by);
        if (distance < 180) {
          context.beginPath(); context.moveTo(ax,ay); context.lineTo(bx,by);
          context.strokeStyle = `rgba(196,216,199,${(1-distance/180)*(.10+energy*.18)})`;
          context.lineWidth = .7 + energy*.8; context.stroke();
        }
      }
      context.beginPath(); context.arc(ax,ay,1.1+energy,0,Math.PI*2);
      context.fillStyle = `rgba(239,105,80,${.34 + .18*Math.sin(time*.001+a.phase) + energy*.22})`; context.shadowBlur=10+energy*18; context.shadowColor='rgba(239,82,59,.65)'; context.fill(); context.shadowBlur=0;
    }
    requestAnimationFrame(drawField);
  }

  addEventListener('pointermove', event => {
    fieldPointerX = event.clientX / innerWidth;
    fieldPointerY = event.clientY / innerHeight;
    document.documentElement.style.setProperty('--pointer-x', `${event.clientX}px`);
    document.documentElement.style.setProperty('--pointer-y', `${event.clientY}px`);
  }, {passive:true});
  document.addEventListener('visibilitychange', () => { fieldVisible = !document.hidden; });
  addEventListener('resize', resizeField);
  resizeField();
  requestAnimationFrame(drawField);
}

if (matchMedia('(pointer:fine)').matches && !reduceMotion) {
  const tiltSelector = '.book-card,.mini-book,.answer-insight-grid article,.terminal-card,.question-note-frame,.question-deck';
  const magneticSelector = '.primary-action,.experience-root,.modal-continue,.answer-actions button,.note-scene-actions button,.entry-sound';
  document.addEventListener('pointermove', event => {
    const tilt = event.target.closest(tiltSelector);
    if (tilt) {
      const rect = tilt.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      tilt.style.setProperty('--tilt-x', `${(.5-y)*5}deg`);
      tilt.style.setProperty('--tilt-y', `${(x-.5)*6}deg`);
      tilt.style.setProperty('--glow-x', `${x*100}%`);
      tilt.style.setProperty('--glow-y', `${y*100}%`);
      tilt.classList.add('is-tilting');
    }
    const magnetic = event.target.closest(magneticSelector);
    if (magnetic) {
      const rect = magnetic.getBoundingClientRect();
      magnetic.style.setProperty('--mag-x', `${(event.clientX - rect.left - rect.width/2)*.08}px`);
      magnetic.style.setProperty('--mag-y', `${(event.clientY - rect.top - rect.height/2)*.1}px`);
      magnetic.classList.add('magnetic');
    }
  }, {passive:true});
  document.addEventListener('pointerout', event => {
    const tilt = event.target.closest(tiltSelector);
    if (tilt && !tilt.contains(event.relatedTarget)) tilt.classList.remove('is-tilting');
    const magnetic = event.target.closest(magneticSelector);
    if (magnetic && !magnetic.contains(event.relatedTarget)) {
      magnetic.style.setProperty('--mag-x','0px'); magnetic.style.setProperty('--mag-y','0px');
      magnetic.classList.remove('magnetic');
    }
  });
}
