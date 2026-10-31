import {MAX_ARCHIVED_MESSAGES,normalizeChatHistory,olderChatMessages,buildChatContext} from '/chat/history.mjs';
const token = document.querySelector('meta[name="atlas-token"]').content;
const conversationStorageKey = 'atlas-conversations-v2';
const legacyHistoryKey = 'atlas-chat-v1';
const maxConversations = 1000;
const localCacheLimit = 30;
const maxMessagesPerConversation = MAX_ARCHIVED_MESSAGES;
const fileExtensions = new Set(['txt','md','markdown','json','js','mjs','ts','tsx','jsx','py','html','htm','css','scss','xml','yaml','yml','toml','sql','csv','log','cs','c','cpp','h','hpp','java','rs','go','sh','ps1','ipynb']);
const maxFiles = 3;
const maxFileBytes = 60000;
const maxTotalText = 20000;
const $ = id => document.getElementById(id);
const archiveSignalKey = 'atlas-chat-archive-updated';

let conversations = [];
let activeConversationId = null;
let history = [];
let attachments = [];
let busy = false;
let externalConfigured = false;
let archiveReady = Promise.resolve();
let archiveDatabasePromise = null;
let archiveHydrated = false;
let archiveLoading = false;
let archiveMode = 'Restaurando el archivo local…';
let memoryArchiveCount = 0;
const personalMemoryPairCache = new WeakMap();
let thinkingStartedAt = 0;
let thinkingTimer = null;
let activeRequestOptions = { internet: false, external: false, tools: false };
let requestController = null;
let activeStreamStage = '';
let streamedDraft = '';
let visibleMessageLimit=80;

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined;
  const safe = {};
  for (const key of ['reviewScope','modelName']) if (typeof meta[key] === 'string') safe[key] = meta[key].slice(0, 600);
  if (Array.isArray(meta.sources)) safe.sources = meta.sources.slice(0, 12).filter(source => source && typeof source === 'object').map(source => ({
    ...(typeof source.url === 'string' ? { url: source.url.slice(0, 2000) } : {}),
    ...(typeof source.title === 'string' ? { title: source.title.slice(0, 300) } : {}),
    ...(typeof source.excerpt === 'string' ? { excerpt: source.excerpt.slice(0, 3000) } : {}),
    ...(typeof source.method === 'string' ? { method: source.method.slice(0, 160) } : {}),
    ...(typeof source.fetchedAt === 'string' ? { fetchedAt: source.fetchedAt.slice(0, 80) } : {})
  }));
  if (Array.isArray(meta.warnings)) safe.warnings = meta.warnings.filter(item => typeof item === 'string').slice(0, 8).map(item => item.slice(0, 600));
  for (const key of ['internetRequested','webRead']) if (typeof meta[key] === 'boolean') safe[key] = meta[key];
  if (Array.isArray(meta.failedWebUrls)) safe.failedWebUrls = meta.failedWebUrls.filter(item => typeof item === 'string').slice(0, 5).map(item => item.slice(0, 2000));
  for (const key of ['reflectionMemoryUsed','personalMemoryUsed']) if (Number.isInteger(meta[key]) && meta[key] >= 0) safe[key] = meta[key];
  if(meta.toolRun&&typeof meta.toolRun==='object'&&!Array.isArray(meta.toolRun)){
    const run={};
    if(typeof meta.toolRun.used==='boolean')run.used=meta.toolRun.used;
    for(const key of ['name','error'])if(typeof meta.toolRun[key]==='string')run[key]=meta.toolRun[key].slice(0,key==='name'?200:600);
    try{const result=JSON.stringify(meta.toolRun.result);if(typeof result==='string'&&result.length<=10000)run.result=JSON.parse(result);}catch{}
    if(Object.keys(run).length)safe.toolRun=run;
  }
  return Object.keys(safe).length ? safe : undefined;
}

function cleanMessages(messages) {
  return normalizeChatHistory(messages,{maxMessages:maxMessagesPerConversation,cleanMeta});
}

function titleFor(messages) {
  const first = messages.find(message => message.role === 'user');
  return (first?.content || 'Nueva conversación').replace(/\s+/g, ' ').trim().slice(0, 66);
}

function loadConversationStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(conversationStorageKey) || 'null');
    if (saved?.version === 2 && Array.isArray(saved.conversations)) {
      conversations = saved.conversations
        .map(item => {
          const messages = cleanMessages(item?.messages);
          if (!messages.length) return null;
          return {
            id: typeof item.id === 'string' ? item.id.slice(0, 100) : makeId(),
            title: titleFor(messages),
            updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
            messages
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, maxConversations);
      activeConversationId = typeof saved.activeConversationId === 'string'
        ? saved.activeConversationId.slice(0,100)
        : conversations[0]?.id || null;
    } else {
      const legacy = JSON.parse(localStorage.getItem(legacyHistoryKey) || '[]');
      const messages = cleanMessages(legacy);
      if (messages.length) {
        activeConversationId = makeId();
        conversations = [{ id: activeConversationId, title: titleFor(messages), updatedAt: Date.now(), messages }];
      }
    }
  } catch {
    conversations = [];
    activeConversationId = null;
  }
  history = cleanMessages(conversations.find(item => item.id === activeConversationId)?.messages || []);
}

function openArchiveDatabase() {
  if (archiveDatabasePromise) return archiveDatabasePromise;
  const pending = new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB no está disponible')); return; }
    const request = window.indexedDB.open('atlas-chat-archive', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('conversations')) db.createObjectStore('conversations', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); archiveDatabasePromise = null; };
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error('No se pudo abrir el archivo local'));
    request.onblocked = () => reject(new Error('El archivo local está bloqueado por otra pestaña'));
  });
  archiveDatabasePromise = pending;
  pending.catch(() => { if (archiveDatabasePromise === pending) archiveDatabasePromise = null; });
  return pending;
}

function archiveTransactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Falló una transacción del archivo local'));
    transaction.onabort = () => reject(transaction.error || new Error('Se canceló una transacción del archivo local'));
  });
}

function archiveRequestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo leer el archivo local'));
  });
}

function normalizeStoredConversation(item) {
  const messages = cleanMessages(item?.messages);
  if (!messages.length) return null;
  return {
    id: typeof item.id === 'string' && item.id ? item.id.slice(0, 100) : makeId(),
    title: titleFor(messages),
    updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
    messages
  };
}

async function readArchiveConversations() {
  const db = await openArchiveDatabase();
  const transaction = db.transaction('conversations', 'readonly');
  const done = archiveTransactionDone(transaction);
  const request = archiveRequestResult(transaction.objectStore('conversations').getAll());
  const [records] = await Promise.all([request, done]);
  return records;
}

async function writeArchiveConversations(records = [], deleteIds = []) {
  const db = await openArchiveDatabase();
  const transaction = db.transaction('conversations', 'readwrite');
  const done = archiveTransactionDone(transaction);
  const store = transaction.objectStore('conversations');
  for (const record of records) store.put(record);
  for (const id of deleteIds) store.delete(id);
  await done;
}

function saveConversationCache() {
  // IndexedDB is the complete archive. Cache only whole records that fit, so a
  // large conversation cannot exhaust localStorage or be mistaken for a newer
  // partial copy when the page reopens.
  const cached=[];let characters=0;
  for(const record of conversations.slice(0,localCacheLimit)){
    const size=JSON.stringify(record).length;
    if(characters+size>1200000)continue;
    cached.push(record);characters+=size;
  }
  localStorage.setItem(conversationStorageKey, JSON.stringify({ version: 2, activeConversationId, conversations: cached }));
}

async function hydrateConversationArchive({ refreshView = true } = {}) {
  if (archiveLoading) return false;
  archiveLoading = true;
  const localRecords = conversations.map(normalizeStoredConversation).filter(Boolean);
  const localActiveId = activeConversationId;
  try {
    const stored = (await readArchiveConversations()).map(normalizeStoredConversation).filter(Boolean);
    const byId = new Map(stored.map(item => [item.id, item]));
    const changed = [];
    for (const local of localRecords) {
      const previous = byId.get(local.id);
      if (!previous || local.updatedAt > previous.updatedAt) {
        byId.set(local.id, local);
        changed.push(local);
      }
    }
    const merged = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    const retained = merged.slice(0, maxConversations);
    const removedIds = merged.slice(maxConversations).map(item => item.id);
    await writeArchiveConversations(changed, removedIds);
    conversations = retained;
    memoryArchiveCount = retained.length;
    activeConversationId = retained.some(item => item.id === localActiveId) ? localActiveId : retained[0]?.id || null;
    history = cleanMessages(retained.find(item => item.id === activeConversationId)?.messages || []);
    archiveMode = `Archivo local IndexedDB · ${memoryArchiveCount} conversaciones · límite ${maxConversations}`;
    try { saveConversationCache(); } catch { /* IndexedDB remains the source of truth when the small cache is full. */ }
    archiveHydrated = true;
    if (refreshView) { updateToggles(); render(false); }
    return true;
  } catch {
    archiveHydrated = true;
    memoryArchiveCount = conversations.length;
    archiveMode = `Caché local disponible · ${memoryArchiveCount} conversaciones; archivo ampliado no disponible`;
    if (refreshView) updateToggles();
    return false;
  } finally {
    archiveLoading = false;
  }
}

async function persistConversationArchive(record, deleteIds = []) {
  if (!archiveHydrated) return;
  try {
    await writeArchiveConversations([record], deleteIds);
    memoryArchiveCount = conversations.length;
    archiveMode = `Archivo local IndexedDB · ${memoryArchiveCount} conversaciones · límite ${maxConversations}`;
    localStorage.setItem(archiveSignalKey, String(Date.now()));
    updateToggles();
  } catch {
    archiveMode = 'Caché local del navegador disponible; no se pudo ampliar el archivo';
    updateToggles();
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeLink(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function requestedWebUrls(text) {
  return [...new Set((text.match(/https:\/\/[^\s<>"']+/g) || [])
    .map(value => value.replace(/[),.;!?]+$/, ''))
    .map(safeLink).filter(Boolean))].slice(0, 5);
}

function asksForPageEvidence(text) {
  return /\b(resum(?:e|en|ir)|idea principal|qu[eé] explica|qu[eé] dice|seg[uú]n (?:esta )?p[aá]gina|cita(?:r)? la p[aá]gina|contenido de (?:esta )?p[aá]gina)\b/i.test(text);
}

function appendInline(parent, text) {
  const pattern = /(\x60[^\x60]+\x60|\*\*[\s\S]+?\*\*|\*[^*]+\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<]+))/g;
  let start = 0;
  let match;
  while ((match = pattern.exec(text))) {
    parent.append(document.createTextNode(text.slice(start, match.index)));
    const part = match[1];
    if (part.startsWith('\x60')) parent.append(el('code', null, part.slice(1, -1)));
    else if (part.startsWith('**')) parent.append(el('strong', null, part.slice(2, -2)));
    else if (part.startsWith('*')) parent.append(el('em', null, part.slice(1, -1)));
    else if (match[2] && match[3]) {
      const href = safeLink(match[3]);
      if (href) {
        const link = el('a', null, match[2]);
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        parent.append(link);
      } else parent.append(document.createTextNode(part));
    } else {
      const href = safeLink(part.replace(/[),.;!?]+$/, ''));
      if (href) {
        const link = el('a', null, href);
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        parent.append(link);
        const tail = part.slice(href.length);
        if (tail) parent.append(document.createTextNode(tail));
      } else parent.append(document.createTextNode(part));
    }
    start = pattern.lastIndex;
  }
  parent.append(document.createTextNode(text.slice(start)));
}

function renderMarkdown(root, text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    if (/^\s*\x60{3}/.test(line)) {
      const language = line.replace(/^\s*\x60{3}/, '').trim() || 'código';
      index++;
      const codeLines = [];
      while (index < lines.length && !/^\s*\x60{3}/.test(lines[index])) codeLines.push(lines[index++]);
      if (index < lines.length) index++;
      const block = el('div', 'code-block');
      const bar = el('div', 'code-toolbar');
      const copy = el('button', null, 'Copiar código');
      copy.type = 'button';
      copy.addEventListener('click', () => copyText(codeLines.join('\n'), copy));
      bar.append(el('span', null, language), copy);
      const pre = el('pre');
      pre.append(el('code', null, codeLines.join('\n')));
      block.append(bar, pre);
      root.append(block);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const node = el(heading[1].length === 1 ? 'h2' : 'h3');
      appendInline(node, heading[2]);
      root.append(node);
      index++;
      continue;
    }
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (ordered || bullet) {
      const orderedList = Boolean(ordered);
      const list = el(orderedList ? 'ol' : 'ul');
      while (index < lines.length) {
        const item = lines[index].match(orderedList ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*]\s+(.+)$/);
        if (!item) break;
        const li = el('li');
        appendInline(li, item[1]);
        list.append(li);
        index++;
      }
      root.append(list);
      continue;
    }
    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !/^\s*\x60{3}/.test(lines[index]) && !/^#{1,3}\s+/.test(lines[index]) && !/^\s*[-*]\s+/.test(lines[index]) && !/^\s*\d+[.)]\s+/.test(lines[index])) paragraph.push(lines[index++]);
    const p = el('p');
    appendInline(p, paragraph.join(' '));
    root.append(p);
  }
}

function copyText(value, button) {
  if (!navigator.clipboard) { button.textContent = 'No disponible'; return; }
  navigator.clipboard.writeText(value)
    .then(() => { const old = button.textContent; button.textContent = 'Copiado'; setTimeout(() => { button.textContent = old; }, 1400); })
    .catch(() => { button.textContent = 'No disponible'; });
}

function addSources(parent, sources) {
  if (!Array.isArray(sources) || !sources.length) return;
  const details = el('details', 'sources');
  details.append(el('summary', null, `Fuentes y contexto (${sources.length})`));
  for (const source of sources) {
    const card = el('div', 'source-card');
    const href = safeLink(source.url);
    if (href) {
      const link = el('a', null, source.title || source.url);
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      card.append(link);
    }
    if (source.excerpt) card.append(el('p', null, source.excerpt));
    card.append(el('p', null, (source.method || 'Fuente local') + (source.fetchedAt ? ` · ${new Date(source.fetchedAt).toLocaleString()}` : '')));
    details.append(card);
  }
  parent.append(details);
}

function renderMessage(message) {
  const article = el('article', `message ${message.role}`);
  const avatar = el('span', 'message-avatar', message.role === 'user' ? 'Tú' : '✳');
  const main = el('div', 'message-main');
  const author = el('div', 'message-author', message.role === 'user' ? 'TÚ' : `ATLAS · ${message.meta?.modelName || 'modelo local'}`);
  const body = el('div', 'message-body');
  if (message.role === 'assistant') renderMarkdown(body, message.content);
  else body.textContent = message.content;
  main.append(author, body);
  if (message.meta?.reviewScope) main.append(el('div', 'message-meta', message.meta.reviewScope));
  if (message.meta?.personalMemoryUsed) main.append(el('div', 'message-meta', `Memoria local relacionada recuperada: ${message.meta.personalMemoryUsed} conversación(es).`));
  if (message.meta?.reflectionMemoryUsed) main.append(el('div', 'message-meta', `Reflejos de agentes relacionados usados como contexto: ${message.meta.reflectionMemoryUsed}; no modifican los pesos de Qwen.`));
  if (message.meta?.internetRequested && message.meta.webRead === false) {
    const detail = message.meta.failedWebUrls?.length ? ` No se pudo leer: ${message.meta.failedWebUrls.join(', ')}.` : '';
    main.append(el('div', 'message-meta message-meta-warning', `No se verificó ninguna fuente web en este turno.${detail} Trata la respuesta como no verificada y revisa los avisos.`));
  }
  if (message.meta?.toolRun?.used) main.append(el('div', 'message-meta', `Herramienta ejecutada: ${message.meta.toolRun.name} · ${JSON.stringify(message.meta.toolRun.result)}`));
  if (message.meta?.toolRun?.error) main.append(el('div', 'message-meta', `Herramienta no disponible: ${message.meta.toolRun.error}`));
  if (message.meta?.warnings?.length) main.append(el('div', 'message-meta', `Avisos: ${message.meta.warnings.join('; ')}`));
  addSources(main, message.meta?.sources);
  if (message.role === 'assistant') {
    const actions = el('div', 'message-actions');
    const copy = el('button', 'copy-message', 'Copiar respuesta');
    copy.type = 'button';
    copy.addEventListener('click', () => copyText(message.content, copy));
    actions.append(copy);
    main.append(actions);
  }
  article.append(avatar, main);
  return article;
}

function dateLabel(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

function saveConversation() {
  if (!history.length) return;
  if (!activeConversationId) activeConversationId = makeId();
  const current = {
    id: activeConversationId,
    title: titleFor(history),
    updatedAt: Date.now(),
    messages: cleanMessages(history)
  };
  const beforeIds = conversations.map(item => item.id);
  conversations = [current, ...conversations.filter(item => item.id !== activeConversationId)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, maxConversations);
  try { saveConversationCache(); }
  catch {
    $('status').textContent = 'No pude actualizar la caché local; el archivo ampliado sigue activo si IndexedDB está disponible.';
    $('status').classList.add('error');
  }
  memoryArchiveCount = conversations.length;
  const retainedIds = new Set(conversations.map(item => item.id));
  const removedIds = beforeIds.filter(id => !retainedIds.has(id));
  void persistConversationArchive(current, removedIds);
}

function renderConversationList() {
  const list = $('conversation-list');
  const query = $('conversation-search').value.trim().toLocaleLowerCase();
  const visible = conversations.filter(item => !query || item.title.toLocaleLowerCase().includes(query) || item.messages.some(message => message.content.toLocaleLowerCase().includes(query)));
  list.replaceChildren();
  for (const conversation of visible.slice(0, 100)) {
    const button = el('button', 'conversation-item');
    button.type = 'button';
    button.setAttribute('aria-current', String(conversation.id === activeConversationId));
    button.title = conversation.title;
    button.append(el('span', 'conversation-title', conversation.title), el('span', 'conversation-date', dateLabel(conversation.updatedAt)));
    button.addEventListener('click', () => openConversation(conversation.id));
    list.append(button);
  }
  $('conversation-empty').textContent = query && conversations.length
    ? 'No hay conversaciones que coincidan.'
    : 'Tus conversaciones aparecerán aquí.';
  $('conversation-empty').hidden = visible.length > 0;
  $('conversation-overflow').textContent = visible.length > 100 ? `Mostrando 100 de ${visible.length}. Busca para filtrar el archivo.` : '';
}

function openConversation(id) {
  if (busy) return;
  saveConversation();
  const conversation = conversations.find(item => item.id === id);
  if (!conversation) return;
  activeConversationId = id;
  visibleMessageLimit=80;
  history = cleanMessages(conversation.messages);
  render();
  $('sidebar').classList.remove('open');
  $('sidebar-backdrop').classList.remove('open');
  $('message').focus();
}

function render(persist = true) {
  const area = $('history');
  area.replaceChildren(...history.slice(-visibleMessageLimit).map(renderMessage));
  if(history.length>visibleMessageLimit){
    const earlier=el('button','earlier-messages',`Ver mensajes anteriores · ${history.length-visibleMessageLimit} más`);
    earlier.type='button';earlier.disabled=busy;
    earlier.addEventListener('click',()=>{
      const oldHeight=area.scrollHeight,oldTop=area.scrollTop;
      visibleMessageLimit+=80;render(false);area.scrollTop=oldTop+area.scrollHeight-oldHeight;
    });
    area.prepend(earlier);
  }
  area.classList.toggle('has-messages', history.length > 0);
  $('welcome').hidden = history.length > 0;
  $('thread-title').textContent = history.length ? titleFor(history) : '¿Qué exploramos hoy?';
  if (persist) saveConversation();
  renderConversationList();
  if (area.lastElementChild) area.scrollTop = area.scrollHeight;
}

const stopwords = new Set('atlas conversar conversación conversaciones el la los las un una unos unas de del que por para como con desde hasta sobre entre cual cuales quién quiénes donde dónde cuando cuándo porque porque hacia contra sin durante mediante segun tras este esta estos estas esto ese esa esos esas aquel aquella aquello son eres era fui ser estar haber hacer hizo hacerlo poder puedo puedes puede podemos pueden quiero quieres queremos necesito necesitas necesitamos tengo tienes tiene tenemos tienen decir dice dijo ahora luego antes despues después tambien también muy mucho mucha muchos muchas menos más mi mis tu tus su sus nos les me te se ellos ellas cada otro otra otros otras todos todo todas algo nada quien quienes mismo misma mismos aqui aquí allí y o e u ni que if the is are was were be been being and or but for to from of in on by with without how what when where who whom why can could would should has have had do does did will might may must'.split(' '));
function memoryTerms(text) {
  return (String(text).toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9_]{3,}/g) || [])
    .filter(term => !stopwords.has(term));
}

function memoryPairsForConversation(conversation) {
  const cached = personalMemoryPairCache.get(conversation);
  if (cached) return cached;
  const pairs = [];
  for (let index = 0; index < conversation.messages.length; index++) {
    const question = conversation.messages[index];
    if (question.role !== 'user') continue;
    const answer = conversation.messages[index + 1];
    if (answer?.role!=='assistant') continue;
    const terms = memoryTerms(`${question.content} ${answer.content}`);
    const frequencies = new Map();
    for (const term of terms) frequencies.set(term, (frequencies.get(term) || 0) + 1);
    pairs.push({
      id: conversation.id,
      messageIndex:index,
      updatedAt: conversation.updatedAt,
      title: conversation.title,
      question: question.content.slice(0, 900),
      answer: answer.content.slice(0, 1400),
      questionTerms: memoryTerms(question.content),
      frequencies,
      length: terms.length
    });
  }
  personalMemoryPairCache.set(conversation, pairs);
  return pairs;
}

function retrievePersonalMemories(query) {
  if (!$('memory').checked) return [];
  const queryTokens = memoryTerms(query);
  const queryTerms = new Set(queryTokens);
  if (!queryTerms.size) return [];
  const pairs = [];
  const olderCount=olderChatMessages([...history,{role:'user',content:query}],{maxMessages:15,maxCharacters:attachments.length?6000:10000}).length;
  for (const conversation of conversations) {
    const archivedPairs=memoryPairsForConversation(conversation);
    pairs.push(...(conversation.id===activeConversationId?archivedPairs.filter(pair=>pair.messageIndex+1<olderCount):archivedPairs));
  }
  if (!pairs.length) return [];
  const documentFrequency = new Map();
  for (const pair of pairs) for (const term of pair.frequencies.keys()) documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
  const averageLength = pairs.reduce((sum, pair) => sum + pair.length, 0) / pairs.length || 1;
  const queryBigrams = [];
  for (let index = 0; index < queryTokens.length - 1; index++) queryBigrams.push(`${queryTokens[index]} ${queryTokens[index + 1]}`);
  const uniqueCandidates = new Map();
  const now = Date.now();
  for (const pair of pairs) {
    let score = 0;
    let matched = 0;
    let rarestMatch = 0;
    for (const term of queryTerms) {
      const frequency = pair.frequencies.get(term) || 0;
      if (!frequency) continue;
      matched++;
      const idf = Math.log(1 + (pairs.length - (documentFrequency.get(term) || 0) + 0.5) / ((documentFrequency.get(term) || 0) + 0.5));
      rarestMatch = Math.max(rarestMatch, idf);
      const lengthScale = 0.25 + 0.75 * pair.length / averageLength;
      score += idf * (frequency * 2.2) / (frequency + 1.2 * lengthScale);
    }
    const singleTermThreshold = queryTerms.size === 1 ? 2.5 : 1.8;
    if (matched < 2 && !(matched === 1 && rarestMatch >= singleTermThreshold)) continue;
    score /= Math.sqrt(queryTerms.size);
    if (queryBigrams.length) {
      const questionText = pair.questionTerms.join(' ');
      const phraseHits = queryBigrams.filter(bigram => questionText.includes(bigram)).length;
      score += 0.35 * phraseHits / queryBigrams.length;
    }
    const ageDays = Math.max(0, now - pair.updatedAt) / 86400000;
    score += 0.08 / (1 + ageDays / 30);
    if (score < 0.42) continue;
    const existing = uniqueCandidates.get(pair.id);
    if (!existing || score > existing.score) uniqueCandidates.set(pair.id, { ...pair, score });
  }
  const candidates = [...uniqueCandidates.values()].sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
  const selected = [];
  for (const candidate of candidates) {
    selected.push({ title: candidate.title, question: candidate.question, answer: candidate.answer });
    if (selected.length === 2) break;
  }
  return selected;
}

function buildModelMessages(messages, memories) {
  return buildChatContext(messages,memories,{maxMessages:15,maxCharacters:attachments.length?6000:10000});
}

function updateToggles() {
  document.querySelectorAll('[data-toggle]').forEach(button => {
    const box = $(button.dataset.toggle);
    button.classList.toggle('selected', box.checked);
    button.setAttribute('aria-pressed', String(box.checked));
  });
  const external = $('external').checked;
  const memoryCount = archiveHydrated ? memoryArchiveCount : conversations.length;
  $('memory-info').textContent = $('memory').checked
    ? `Memoria activada · ${memoryCount} conversación(es) · hasta ${maxMessagesPerConversation} mensajes por conversación. Recupera recuerdos relevantes, también de este chat. ${archiveHydrated ? archiveMode : 'Restaurando el archivo local…'}.`
    : `Memoria desactivada · ${memoryCount} conversación(es) siguen guardadas localmente.`;
  const settings = $('external-settings');
  if (!external) {
    $('external-info').textContent = 'La mesa de estrellas está apagada.';
    settings.hidden = true;
  } else if (!externalConfigured) {
    $('external-info').textContent = 'OpenRouter no está conectado; no se consultarán agentes.';
    settings.hidden = false;
  } else {
    let council = [];
    try { const stored = JSON.parse(localStorage.getItem('atlas-council-models') || '[]'); if (Array.isArray(stored)) council = stored; } catch {}
    const count = Array.isArray(council) ? Math.min(council.length, 3) : 0;
    $('external-info').textContent = `Se enviarán la pregunta y el borrador de Atlas${$('memory').checked ? ', que puede reflejar memoria local' : ''}${attachments.length ? ' y los adjuntos' : ''} a ${count ? count + ' modelo(s) seleccionado(s)' : 'un modelo gratuito de OpenRouter'}.`;
    settings.hidden = true;
  }
}

function renderFiles() {
  const list = $('file-list');
  list.replaceChildren();
  attachments.forEach((file, index) => {
    const pill = el('span', 'file-pill', `▧ ${file.name} · ${file.text.length.toLocaleString()} caracteres`);
    const remove = el('button', null, '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Quitar ${file.name}`);
    remove.addEventListener('click', () => { attachments.splice(index, 1); renderFiles(); updateToggles(); });
    pill.append(remove);
    list.append(pill);
  });
  updateToggles();
}

async function loadFiles(files) {
  const candidates = [...files];
  if (attachments.length + candidates.length > maxFiles) { $('status').textContent = `Adjunta como máximo ${maxFiles} archivos por consulta.`; return; }
  for (const file of candidates) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (!fileExtensions.has(extension)) { $('status').textContent = `Formato no admitido: ${file.name}`; continue; }
    if (file.size > maxFileBytes) { $('status').textContent = `${file.name} supera el límite local de 60 KB.`; continue; }
    try {
      const content = await file.text();
      const total = attachments.reduce((sum, item) => sum + item.text.length, 0) + content.length;
      if (total > maxTotalText) { $('status').textContent = 'Los archivos superan el límite conjunto de 20 000 caracteres.'; continue; }
      attachments.push({ name: file.name.slice(0, 120), text: content });
      $('status').textContent = 'Leído en el navegador; solo se envía a Atlas en este turno.';
      renderFiles();
    } catch (error) { $('status').textContent = `No pude leer ${file.name}: ${error.message}`; }
  }
  $('file-input').value = '';
}

function resizeInput() {
  const box = $('message');
  box.style.height = 'auto';
  box.style.height = `${Math.min(box.scrollHeight, 180)}px`;
}

function thinkingMessage() {
  const article = el('article', 'message assistant thinking-message');
  article.append(el('span', 'message-avatar', '✳'));
  const main = el('div', 'message-main');
  const title = el('div', 'thinking-title');
  title.append(el('span', 'thinking-stars', '✳'), document.createTextNode('Atlas está preparando una respuesta'));
  const dots = el('span', 'thinking-dots');
  dots.append(el('i'), el('i'), el('i'));
  title.append(dots);
  const meta = el('div', 'thinking-meta');
  meta.id = 'thinking-meta';
  main.append(title, meta);
  const provisional=el('div','stream-provisional');provisional.id='stream-provisional';provisional.hidden=true;
  provisional.append(el('span','stream-label','Borrador provisional · puede cambiar durante la revisión'));
  const text=el('div','stream-text');text.id='stream-text';text.setAttribute('aria-live','off');provisional.append(text);main.append(provisional);
  article.append(main);
  return article;
}

function updateThinkingProgress() {
  if (!busy) return;
  const seconds = Math.max(0, Math.floor((Date.now() - thinkingStartedAt) / 1000));
  const pending = [activeRequestOptions.internet && 'la lectura web', activeRequestOptions.external && 'la mesa gratuita', activeRequestOptions.tools && 'la herramienta local'].filter(Boolean);
  let message = 'Qwen está preparando la respuesta local.';
  if (seconds >= 15 && seconds < 45) message = pending.length
    ? `Atlas procesa la consulta y espera ${pending.join(' y ')} · ${seconds} s.`
    : `Qwen está razonando en la GPU · ${seconds} s.`;
  if (seconds >= 45) message = `Atlas sigue procesando · ${seconds} s. ${pending.length ? `Puede estar esperando ${pending.join(' y ')}. ` : ''}No reenvíes la pregunta; esta solicitud sigue abierta.`;
  const stages={web:'Consultando fuentes públicas',tools:'Seleccionando una herramienta local',draft:'Escribiendo el borrador',review:'Revisando la respuesta',council:'Decidiendo si hace falta revisar'};
  if(stages[activeStreamStage])message=stages[activeStreamStage]+` · ${seconds} s. Puedes detener la respuesta.`;
  const meta = $('thinking-meta');
  if (meta) meta.textContent = message;
  $('status').textContent = message;
}

function receiveStreamEvent(event){
  if(event.type==='stage'){
    activeStreamStage=event.stage;
    if(event.stage==='draft'||event.stage==='review'){
      streamedDraft='';const text=$('stream-text');if(text)text.textContent='';
      const panel=$('stream-provisional');if(panel)panel.hidden=true;
    }
    updateThinkingProgress();
  }
  if(event.type==='delta'){
    if(event.stage&&event.stage!==activeStreamStage){activeStreamStage=event.stage;streamedDraft='';}
    streamedDraft+=event.text;
    const text=$('stream-text'),panel=$('stream-provisional');
    const area=$('history');
    const followHistory=area.scrollHeight-area.scrollTop-area.clientHeight<200;
    const followDraft=text&&text.scrollHeight-text.scrollTop-text.clientHeight<60;
    if(text)text.textContent=streamedDraft;
    if(panel)panel.hidden=false;
    if(followDraft)text.scrollTop=text.scrollHeight;
    if(followHistory)area.scrollTop=area.scrollHeight;
  }
}

function setBusy(value) {
  busy = value;
  $('send').disabled = value;
  $('send').hidden = value;
  $('stop').hidden = !value;
  $('stop').disabled = !value;
  $('message').disabled = value;
  $('new-chat').disabled = value;
  $('attach-button').disabled = value;
  document.querySelectorAll('.earlier-messages').forEach(button=>{button.disabled=value;});
  document.querySelectorAll('#file-list button').forEach(button=>{button.disabled=value;});
  if (value) $('status').classList.remove('error');
  if (thinkingTimer) clearInterval(thinkingTimer);
  thinkingTimer = null;
  document.querySelector('.thinking-message')?.remove();
  if (value) {
    activeStreamStage='';streamedDraft='';
    thinkingStartedAt = Date.now();
    $('history').append(thinkingMessage());
    $('history').scrollTop = $('history').scrollHeight;
    updateThinkingProgress();
    thinkingTimer = setInterval(updateThinkingProgress, 1000);
  }
}

async function refreshHealth() {
  try {
    const response = await fetch('/chat/health', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    const state = await response.json();
    const online = response.ok && state.ready;
    externalConfigured = state.externalAgents === true;
    $('local-state').textContent = online ? 'Motor local listo' : 'Motor local no disponible';
    $('local-model').textContent = state.modelName || 'Qwen local en tu PC';
    const internetToggle = document.querySelector('[data-toggle="internet"]');
    if (internetToggle) internetToggle.title = state.webSearchProviders?.includes('Google')
      ? 'Al activarlo, envía la consulta a Google y DuckDuckGo Lite. Si Google bloquea el acceso automático, se informa y se usa la alternativa; Wikipedia es el último respaldo. También lee URLs HTTPS públicas.'
      : state.webSearchEngine === 'duckduckgo-lite'
      ? 'Al activarlo, envía la consulta a DuckDuckGo Lite (Wikipedia como respaldo), busca extractos públicos o lee URLs HTTPS que incluyas.'
      : 'Lee URLs HTTPS públicas o busca extractos en Wikipedia; la búsqueda general está pendiente de actualizar el coordinador.';
    $('local-dot').className = `status-dot ${online ? 'online' : 'offline'}`;
    $('top-dot').className = `status-dot ${online ? 'online' : 'offline'}`;
    $('top-engine').textContent = online ? (state.modelName || 'Atlas local') : 'Atlas sin conexión';
    $('top-engine').title = state.gpu || 'Motor local';
    if (!busy) $('status').textContent = online ? `Listo · Qwen se ejecuta en tu PC${state.gpu ? ` · ${state.gpu}` : ''}` : 'El motor local está arrancando o no responde.';
    updateToggles();
  } catch {
    externalConfigured = false;
    const internetToggle = document.querySelector('[data-toggle="internet"]');
    if (internetToggle) internetToggle.title = 'No se pudo comprobar el motor. La búsqueda general puede requerir reiniciar el coordinador.';
    $('local-state').textContent = 'Motor local no disponible';
    $('local-dot').className = 'status-dot offline';
    $('top-dot').className = 'status-dot offline';
    $('top-engine').textContent = 'Sin conexión';
    if (!busy) $('status').textContent = 'No se pudo consultar el estado del motor local.';
    updateToggles();
  }
}

$('chat-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  if (!archiveHydrated) {
    $('status').textContent = 'Restaurando la memoria local…';
    await archiveReady;
  }
  if(busy)return;
  const content = $('message').value.trim();
  if (!content) return;
  const memories = retrievePersonalMemories(content);
  const internetRequested = $('internet').checked;
  const externalRequested = $('external').checked;
  const toolsRequested = $('tools').checked;
  const requestedUrls = requestedWebUrls(content);
  activeRequestOptions = { internet: internetRequested, external: externalRequested, tools: toolsRequested };
  const previousHistory=history;
  const messages = [...previousHistory, { role: 'user', content }];
  history = messages;
  const modelMessages = buildModelMessages(messages, memories);
  render(false);
  setBusy(true);
  requestController=new AbortController();
  const requestSignal=AbortSignal.any([requestController.signal,AbortSignal.timeout(540000)]);
  try {
    const payload = {
      messages: modelMessages,
      refute: $('review').checked,
      internet: internetRequested,
      external: externalRequested,
      externalModel: localStorage.getItem('atlas-external-model') || 'openrouter/free',
      tools: toolsRequested,
      attachments
    };
    try {
      const council = JSON.parse(localStorage.getItem('atlas-council-models') || '[]');
      if (Array.isArray(council) && council.length) payload.externalModels = council.slice(0, 3);
    } catch {}
    const response = await fetch('/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Atlas-Token': token, 'Accept':'application/x-ndjson' },
      body: JSON.stringify(payload),
      signal: requestSignal
    });
    let result;
    if(response.headers.get('content-type')?.includes('application/x-ndjson')){
      const {readChatResponse}=await import('/chat/response-stream.mjs');
      result=await readChatResponse(response,{onEvent:receiveStreamEvent,signal:requestSignal});
    }else{
      result=await response.json();
      if(!response.ok)throw Error(result.error||'Atlas no pudo responder.');
      if(typeof result.answer!=='string')throw Error('Atlas no devolvió una respuesta válida.');
    }
    if (internetRequested && requestedUrls.length && result.webRead !== true && asksForPageEvidence(content)) {
      const exactLocalCopy = (result.sources || []).some(source => requestedUrls.includes(safeLink(source.url)));
      if (!exactLocalCopy) {
        result.answer = `No he podido leer la página solicitada en este turno, así que no voy a inventar su contenido ni citar otra página como si fuera esa. URL: ${requestedUrls.join(', ')}. Puedes pegar aquí el texto o volver a intentarlo cuando se recupere la conexión.`;
        result.failedWebUrls = requestedUrls;
        result.sources = [];
      }
    }
    history = cleanMessages([...messages, {
      role: 'assistant',
      content: result.answer,
      meta: {
        reviewScope: result.reviewScope,
        modelName: result.modelName || result.model,
        sources: result.sources,
        toolRun: result.toolRun,
        warnings: result.warnings,
        internetRequested,
        webRead: result.webRead,
        failedWebUrls: result.failedWebUrls,
        reflectionMemoryUsed: result.reflectionMemoryUsed,
        personalMemoryUsed: memories.length
      }
    }]);
    attachments = [];
    renderFiles();
    $('message').value = '';
    resizeInput();
    render();
    const parts = [result.reviewScope];
    if (memories.length) parts.push(`Memoria local: ${memories.length} recuerdo(s)`);
    if(messages.length+1>maxMessagesPerConversation)parts.push(`Límite del archivo: se conservan los últimos ${maxMessagesPerConversation} mensajes.`);
    if (result.collaborators?.length) parts.push(`Mesa: ${result.collaborators.length} modelo(s)`);
    if (result.webRead) parts.push('Consulta web realizada');
    if (result.sources?.length) parts.push(`${result.sources.length} fuente(s)`);
    $('status').textContent = parts.filter(Boolean).join(' · ');
  } catch (error) {
    history = previousHistory;
    render(false);
    const stopped=requestController?.signal.aborted;
    $('status').textContent = stopped?'Respuesta detenida. Tu mensaje y los adjuntos siguen aquí para reintentarlo.':error.message;
    $('status').classList.toggle('error',!stopped);
  } finally {
    requestController=null;
    setBusy(false);
    $('message').focus();
  }
});

$('stop').addEventListener('click',()=>{if(requestController){$('stop').disabled=true;requestController.abort();$('status').textContent='Deteniendo la respuesta…';}});

$('conversation-search').addEventListener('input', renderConversationList);
$('message').addEventListener('input', resizeInput);
$('message').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('chat-form').requestSubmit(); }
});
$('attach-button').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', event => loadFiles(event.target.files));
document.querySelectorAll('[data-toggle]').forEach(button => button.addEventListener('click', () => {
  const box = $(button.dataset.toggle);
  box.checked = !box.checked;
  updateToggles();
}));
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => {
  $('message').value = button.dataset.prompt;
  $('message').focus();
  resizeInput();
}));
$('new-chat').addEventListener('click', () => {
  if (busy) return;
  activeConversationId = null;
  visibleMessageLimit=80;
  history = [];
  attachments = [];
  renderFiles();
  render();
  $('message').value = '';
  $('status').textContent = 'Conversación nueva. El historial anterior sigue guardado en este navegador.';
  $('message').focus();
});
$('menu-toggle').addEventListener('click', () => {
  $('sidebar').classList.add('open');
  $('sidebar-backdrop').classList.add('open');
});
$('sidebar-backdrop').addEventListener('click', () => {
  $('sidebar').classList.remove('open');
  $('sidebar-backdrop').classList.remove('open');
});

window.addEventListener('storage', event => {
  if (event.key !== archiveSignalKey || !archiveHydrated || busy || $('message').value.trim()) return;
  archiveReady = hydrateConversationArchive();
});

loadConversationStore();
$('send').disabled = true;
$('message').disabled = true;
$('new-chat').disabled = true;
render(false);
renderFiles();
updateToggles();
archiveReady = hydrateConversationArchive();
archiveReady.finally(() => {
  $('send').disabled = false;
  $('message').disabled = false;
  $('new-chat').disabled = false;
  const gameReference=new URLSearchParams(location.search).get('game');
  if(gameReference){
    $('message').value=`Quiero usar ${gameReference.slice(0,200)} como referencia para crear una escena propia. Consulta el catálogo local y, si hay fuentes accesibles, investiga su dirección artística. Separa lo observado de lo que falta comprobar y propone un plan de iluminación, materiales, composición y rendimiento. No afirmes haber visto escenas que no has analizado.`;
    const gameQuestion=new URLSearchParams(location.search).get('question');
    if(gameQuestion)$('message').value+='\nMi pregunta: '+gameQuestion.slice(0,3000);
    $('internet').checked=true;updateToggles();resizeInput();
  }
  $('message').focus();
});
refreshHealth();
setInterval(refreshHealth, 15000);
