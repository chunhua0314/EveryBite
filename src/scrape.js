// 小红书抓取模块：短链 -> 302 长链 -> 手机 UA 取 HTML -> 解析 __INITIAL_STATE__
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const TIMEOUT_MS = 10000;

function extractUrl(input) {
  // 用户可能粘贴整段分享文案，先抠出其中的链接
  const m = String(input).match(/https?:\/\/[^\s，。）)"']+/);
  return m ? m[0] : null;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

async function resolveLongUrl(url) {
  if (/xiaohongshu\.com/.test(url) && /xsec_token=/.test(url)) return url;
  // 短链：手动跟随 302，取 Location
  const res = await fetchWithTimeout(url, {
    method: 'GET',
    redirect: 'manual',
    headers: { 'User-Agent': MOBILE_UA },
  });
  const loc = res.headers.get('location');
  if (!loc) throw new Error(`短链未返回跳转地址（HTTP ${res.status}）`);
  return decodeEntities(loc);
}

function pick(obj, pathList) {
  for (const p of pathList) {
    let cur = obj;
    let ok = true;
    for (const key of p.split('.')) {
      if (cur == null || typeof cur !== 'object') { ok = false; break; }
      cur = cur[key];
    }
    if (ok && cur !== undefined && cur !== null) return cur;
  }
  return undefined;
}

function parseInitialState(html) {
  const m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (!m) return null;
  let raw = m[1];
  // JS 对象字面量里可能含 undefined
  raw = raw.replace(/:\s*undefined\s*([,}])/g, ':null$1');
  try {
    return JSON.parse(raw);
  } catch {
    return { __raw: raw };
  }
}

function regexField(raw, field) {
  const m = raw.match(new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  if (!m) return '';
  try { return JSON.parse(`"${m[1]}"`); } catch { return m[1]; }
}

function extractNoteFromState(state, noteId) {
  // 结构一：noteData.data.noteData（当前网页版实际结构）
  const nd = pick(state, ['noteData.data.noteData']);
  if (nd && (nd.title || nd.desc)) return nd;
  // 结构二：note.noteDetailMap[noteId].note
  const map = pick(state, ['note.noteDetailMap']);
  if (map && typeof map === 'object') {
    const entry = noteId ? map[noteId] : Object.values(map)[0];
    const note = entry && (entry.note || entry);
    if (note && (note.title || note.desc)) return note;
  }
  // 结构三：note.note
  const note3 = pick(state, ['note.note']);
  if (note3 && (note3.title || note3.desc)) return note3;
  return null;
}

function noteToResult(note, noteId, sourceUrl) {
  const images = note.imageList || note.image_list || [];
  let cover = '';
  if (typeof note.cover === 'string') cover = note.cover;
  else if (note.cover && typeof note.cover === 'object') {
    cover = note.cover.urlDefault || note.cover.url || '';
  }
  for (const img of images) {
    if (cover) break;
    cover = (typeof img === 'string' ? img : '') || img.urlDefault || img.url_default || img.url ||
      (Array.isArray(img.infoList) && img.infoList[0] && img.infoList[0].url) || '';
  }
  const tagList = (note.tagList || note.tag_list || [])
    .map(t => (t && (t.name || t.tagName)) || '')
    .filter(Boolean);
  return {
    noteId: noteId || note.noteId || note.note_id || '',
    title: note.title || '',
    desc: note.desc || '',
    cover,
    tags: tagList,
    sourceUrl,
  };
}

async function scrapeNote(input) {
  const url = extractUrl(input);
  if (!url) throw new Error('没有识别到链接，请粘贴包含 http 链接的内容');

  const longUrl = await resolveLongUrl(url);
  const idMatch = longUrl.match(/\/(?:discovery\/item|explore)\/([0-9a-f]{24})/i);
  const noteId = idMatch ? idMatch[1] : '';

  const res = await fetchWithTimeout(longUrl, {
    headers: {
      'User-Agent': MOBILE_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`笔记页面请求失败（HTTP ${res.status}）`);
  const html = await res.text();

  const state = parseInitialState(html);
  if (!state) throw new Error('页面结构变化，未找到笔记数据，请改用「粘贴文字」');

  if (state.__raw) {
    // JSON.parse 失败的兜底：正则直接抽字段
    const title = regexField(state.__raw, 'title');
    const desc = regexField(state.__raw, 'desc');
    if (!title && !desc) throw new Error('未能解析笔记内容，请改用「粘贴文字」');
    const cover = regexField(state.__raw, 'urlDefault') || regexField(state.__raw, 'url');
    return { noteId, title, desc, cover, tags: [], sourceUrl: longUrl };
  }

  const note = extractNoteFromState(state, noteId);
  if (!note) throw new Error('未能解析笔记内容，请改用「粘贴文字」');
  const result = noteToResult(note, noteId, longUrl);
  if (!result.title && !result.desc) throw new Error('笔记内容为空，请改用「粘贴文字」');
  return result;
}

module.exports = { scrapeNote, extractUrl };
