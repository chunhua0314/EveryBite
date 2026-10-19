// AI 整理模块：OpenAI 兼容 chat completions；无 Key 或调用失败时用规则解析兜底
const HEAT_WORDS = ['大火', '旺火', '猛火', '中小火', '中火', '小火', '文火', '微火'];
const TIME_RE = /(\d+\s*(?:分钟|分|秒钟|秒|小时|个钟头))/;

function extractJson(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeRecipeJson(obj, fallbackTitle) {
  const toList = (v) => {
    if (!Array.isArray(v)) return [];
    return v.map(item => {
      if (typeof item === 'string') return { name: item, amount: '' };
      return { name: String(item.name || item[0] || '').trim(), amount: String(item.amount || item[1] || '').trim() };
    }).filter(x => x.name);
  };
  const steps = (Array.isArray(obj.steps) ? obj.steps : []).map(s => {
    if (typeof s === 'string') return { text: s };
    return {
      text: String(s.text || s.content || '').trim(),
      heat: s.heat ? String(s.heat) : '',
      time: s.time ? String(s.time) : '',
    };
  }).filter(s => s.text);
  return {
    title: String(obj.title || fallbackTitle || '').trim(),
    subtitle: String(obj.subtitle || '').trim(),
    summary: String(obj.summary || '').trim(),
    category: String(obj.category || '').trim(),
    duration: String(obj.duration || '').trim(),
    difficulty: ['简单', '中等', '困难'].includes(obj.difficulty) ? obj.difficulty : '',
    taste: String(obj.taste || '').trim(),
    main_ingredient: String(obj.main_ingredient || '').trim(),
    ingredients: toList(obj.ingredients),
    seasonings: toList(obj.seasonings),
    steps,
    notes: String(obj.notes || '').trim(),
    tags: (Array.isArray(obj.tags) ? obj.tags : []).map(t => String(t).trim()).filter(Boolean).slice(0, 4),
    insufficient: !!obj.insufficient,
    reason: String(obj.reason || '').trim(),
  };
}

function buildPrompt(title, noteText, referenceText) {
  const materials = referenceText
    ? `【材料一：笔记正文】
标题：${title || '（无）'}
正文：
${noteText || '（无）'}

【材料二：用户提供的参考文字（小红书AI总结的做法，可信度较高）】
${referenceText}

请综合两份材料整理；内容冲突时以更详细具体的为准。忠实性约束对两份材料同样适用。`
    : `【笔记正文】
标题：${title || '（无）'}
正文：
${noteText || '（无）'}`;

  return `你是一名中餐菜谱整理助手。请把下面给出的材料整理成结构化菜谱。

【忠实性约束（最重要，必须遵守）】
- 严格基于所给材料整理，材料中没有的信息一律留空（空字符串或空数组）。
- 严禁推测、编造、补充"常见做法""通常步骤"或任何材料之外的食材、调料、用量、火候、时间。
- steps 的 heat/time 只有材料明确提到才填写，否则留空字符串。
- 若材料信息不足以构成菜谱（既没有可提取的步骤，也没有可提取的食材），不要硬凑，改为输出：
  {"insufficient": true, "reason": "一句话说明原因，如：正文仅为视频口播预告，未包含具体做法"}

【输出要求】
1. 只输出一个 JSON 对象，不要输出任何其他文字、不要用 markdown 代码块。
2. JSON 结构：
{
  "title": "菜名（简洁，去掉表情和多余修饰）",
  "subtitle": "菜名的英文翻译，全大写，如 COLA CHICKEN WINGS",
  "summary": "一句话简介（口味口感、卖点，30字以内）",
  "category": "主分类，只能填一个，从常见值中选：川菜/粤菜/湘菜/东北菜/江浙菜/家常菜/汤羹/主食/面点/甜品/饮品/轻食/其他，拿不准填\\"家常菜\\"",
  "duration": "总时长，如 25 分钟",
  "difficulty": "难度，只能是 简单/中等/困难 之一",
  "taste": "口味，如 咸甜/香辣/清淡/酸甜",
  "main_ingredient": "主食材，如 鸡肉/牛肉/豆腐",
  "ingredients": [{"name": "食材名", "amount": "用量"}],
  "seasonings": [{"name": "调料名", "amount": "用量"}],
  "steps": [{"text": "步骤内容", "heat": "火候，如大火/中火/小火，没有就空字符串", "time": "耗时，如3分钟，没有就空字符串"}],
  "notes": "注意事项或技巧，没有就空字符串",
  "tags": ["精标签，只给2-3个，最多4个：主要食材1-2个（如 豆腐、鸡肉）+ 特征/场景1个（如 下饭、辣、快手、减脂、30分钟），不要给泛泛的标签"]
}
3. 食材和调料分开：油盐酱醋、葱姜蒜、香料算调料，其余算食材。
4. 用量尽量保留原文写法（如"2勺""300g""适量"）。

${materials}`;
}

async function callLLM(title, text, referenceText) {
  const key = process.env.LLM_API_KEY;
  const baseUrl = (process.env.LLM_BASE_URL || 'https://api.moonshot.cn/v1').replace(/\/+$/, '');
  const model = process.env.LLM_MODEL || 'kimi-k2-0905-preview';
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: '你是菜谱结构化助手，只输出严格 JSON。' },
          { role: 'user', content: buildPrompt(title, text, referenceText) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const data = await res.json();
    const content = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : '';
    return content;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 规则兜底解析 ----------
function guessHeat(line) {
  for (const w of HEAT_WORDS) if (line.includes(w)) return w;
  return '';
}

function parseAmountLine(line) {
  // "鸡腿肉 300g" / "鸡腿肉300克" / "生抽 2勺" / "盐适量"
  const m = line.replace(/[：:，,]/g, ' ').trim().match(/^(.+?)\s+([^\s]+)$/);
  if (m) return { name: m[1].trim(), amount: m[2].trim() };
  const m2 = line.match(/^(.+?)((?:\d+(?:\.\d+)?\s*(?:克|g|ml|毫升|勺|汤匙|茶匙|个|只|片|瓣|段|根|块|碗|杯)).*|适量|少许|若干)$/);
  if (m2) return { name: m2[1].trim(), amount: m2[2].trim() };
  return { name: line.trim(), amount: '' };
}

const SEASONING_WORDS = ['盐', '糖', '醋', '酱油', '生抽', '老抽', '蚝油', '料酒', '油', '葱', '姜', '蒜',
  '辣椒', '花椒', '胡椒', '味精', '鸡精', '八角', '桂皮', '香叶', '淀粉', '生粉', '番茄酱', '豆瓣酱', '香油', '麻油', '孜然'];

function isSeasoning(name) {
  return SEASONING_WORDS.some(w => name.includes(w));
}

const TAG_RULES = [
  ['汤', /汤(?!汁)|炖|煲/], ['快手菜', /快手|十分钟|五分钟|超简单|简单快手/],
  ['减脂', /减脂|低卡|低脂|减肥/], ['甜品', /甜品|蛋糕|布丁|奶茶/],
  ['早餐', /早餐|早饭/], ['面食', /面条|馒头|包子|饺子|馄饨|烙饼|煎饼|拌面|炒面|拉面/],
  ['鸡肉', /鸡/], ['牛肉', /牛/], ['猪肉', /猪|排骨/], ['鱼虾', /鱼|虾/],
  ['素食', /素|豆腐|青菜|蔬菜/],
];

function guessTags(title, text) {
  const tags = [];
  const all = `${title}\n${text}`;
  for (const [tag, re] of TAG_RULES) {
    if (re.test(all)) tags.push(tag);
    if (tags.length >= 3) break;
  }
  return tags.length ? tags : ['家常菜'];
}

function guessCategory(title, text) {
  const all = `${title || ''}\n${text || ''}`;
  if (/汤(?!汁)|炖|煲/.test(all)) return '汤羹';
  if (/甜品|蛋糕|布丁|奶茶|糖水|糕点/.test(all)) return '甜品';
  if (/面条|馒头|包子|饺子|馄饨|烙饼|煎饼|拌面|炒面|拉面|焖饭|炒饭|盖饭|粥/.test(all)) return '主食';
  if (/沙拉|轻食|减脂餐/.test(all)) return '轻食';
  return '家常菜';
}

function ruleFallback(title, text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const ingredients = [];
  const seasonings = [];
  const steps = [];
  const notesLines = [];

  let section = '';
  for (let line of lines) {
    // 分区标题行：标题后同一行的内容也不能丢
    const head = line.match(/^(食材|用料|材料|主料|辅料|调料|调味|酱汁|腌料|步骤|做法|过程|制作方法|烹饪步骤|小贴士|注意|提示|技巧|tips)[:：]\s*(.*)$/i);
    if (head || /^(食材|用料|材料|主料|辅料|调料|调味|酱汁|腌料|步骤|做法|过程|制作方法|烹饪步骤|小贴士|注意|提示|技巧|tips)$/i.test(line)) {
      const word = head ? head[1] : line;
      const rest = head ? head[2] : '';
      if (/^(食材|用料|材料|主料|辅料)$/.test(word)) section = 'ing';
      else if (/^(调料|调味|酱汁|腌料)$/.test(word)) section = 'sea';
      else if (/^(步骤|做法|过程|制作方法|烹饪步骤)$/.test(word)) section = 'step';
      else section = 'note';
      if (!rest) continue;
      line = rest;
    }
    if (section === 'ing') {
      const item = parseAmountLine(line.replace(/^[-·•\d.、\s]+/, ''));
      if (item.name) (isSeasoning(item.name) ? seasonings : ingredients).push(item);
      continue;
    }
    if (section === 'sea') {
      const item = parseAmountLine(line.replace(/^[-·•\d.、\s]+/, ''));
      if (item.name) seasonings.push(item);
      continue;
    }
    if (section === 'note') {
      notesLines.push(line.replace(/^[-·•\d.、\s]+/, ''));
      continue;
    }
    // 编号行视为步骤（无论当前在哪个 section）
    const stepMatch = line.match(/^(?:步骤?\s*)?(\d{1,2})\s*[.、)）:：]?\s*(.+)$/);
    if (stepMatch && stepMatch[2].length >= 6 && !/g|克|勺|ml/i.test(stepMatch[2].slice(0, 6))) {
      section = section === 'ing' || section === 'sea' ? 'step' : section;
      steps.push({ text: stepMatch[2].trim(), heat: guessHeat(stepMatch[2]), time: (stepMatch[2].match(TIME_RE) || [])[1] || '' });
      continue;
    }
    if (section === 'step') {
      steps.push({ text: line, heat: guessHeat(line), time: (line.match(TIME_RE) || [])[1] || '' });
      continue;
    }
  }

  // 正文没有明确分区时：把较长、含动词的句子当步骤
  if (!steps.length) {
    const sentences = String(text || '').split(/[。！？!?\n]/).map(s => s.trim()).filter(s => s.length >= 8);
    const verbs = /洗|切|下锅|翻炒|炒|煎|炸|煮|炖|蒸|烤|腌|搅拌|加|放|倒|焖|焯|收汁|出锅|盛/;
    for (const s of sentences) {
      if (verbs.test(s)) {
        steps.push({ text: s, heat: guessHeat(s), time: (s.match(TIME_RE) || [])[1] || '' });
      }
    }
  }

  // 全文里找"数字+单位"短句补食材
  if (!ingredients.length) {
    const itemRe = /([一-龥]{1,8}?)\s*(\d+(?:\.\d+)?\s*(?:克|g|ml|毫升|勺|个|只|片|瓣|段|根|块))/g;
    let m;
    const src = String(text || '');
    while ((m = itemRe.exec(src)) !== null) {
      const name = m[1].replace(/^[，。、\s]+/, '');
      if (name && name.length >= 1) {
        (isSeasoning(name) ? seasonings : ingredients).push({ name, amount: m[2].trim() });
      }
    }
  }

  // 汇总新字段
  let totalMin = 0;
  for (const s of steps) {
    const m = String(s.time || '').match(/(\d+)\s*(分钟|分|小时|秒)/);
    if (m) totalMin += m[2] === '小时' ? Number(m[1]) * 60 : m[2] === '秒' ? 0 : Number(m[1]);
  }
  const duration = totalMin ? `${totalMin} 分钟` : '';
  const difficulty = steps.length <= 5 ? '简单' : steps.length <= 9 ? '中等' : '困难';
  const allText = `${title || ''}\n${text || ''}`;
  const taste = (allText.match(/咸甜|酸甜|香辣|麻辣|酸辣|清淡|咸鲜|鲜甜|咸香|微辣|甜辣/) || [''])[0];
  const main_ingredient = ingredients.length ? ingredients[0].name : '';

  const insufficient = steps.length === 0 && ingredients.length === 0;

  return {
    title: (title || '').replace(/[🔥🌟✨⭐💥‼️❗️]/g, '').trim().slice(0, 40) || '未命名菜谱',
    subtitle: '',
    summary: '',
    category: guessCategory(title, text),
    duration, difficulty, taste, main_ingredient,
    ingredients, seasonings, steps,
    notes: notesLines.join('\n'),
    tags: guessTags(title, text),
    insufficient,
    reason: insufficient ? '未能从文本中提取到做法信息' : '',
  };
}

async function organizeRecipe({ title, text, referenceText }) {
  // 优先 LLM；LLM 明确判定信息不足时直接返回（不重试、不走规则兜底，避免拼出误导内容）
  if (process.env.LLM_API_KEY) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const content = await callLLM(title, text, referenceText);
        const obj = extractJson(content);
        if (obj) {
          const recipe = normalizeRecipeJson(obj, title);
          if (recipe.insufficient) {
            return { recipe, via: attempt === 0 ? 'llm' : 'llm-retry', insufficient: true, reason: recipe.reason };
          }
          if (recipe.title && (recipe.steps.length || recipe.ingredients.length)) {
            return { recipe, via: attempt === 0 ? 'llm' : 'llm-retry', insufficient: false };
          }
        }
        console.warn(`[ai] LLM 输出校验失败（第 ${attempt + 1} 次）`);
      } catch (e) {
        console.warn(`[ai] LLM 调用失败（第 ${attempt + 1} 次）:`, e.message);
      }
    }
    console.warn('[ai] LLM 不可用，使用规则兜底解析');
  } else {
    console.log('[ai] 未配置 LLM_API_KEY，使用规则兜底解析');
  }
  // 规则兜底：合并正文与参考文字一起解析
  const combined = [text, referenceText].filter(s => s && String(s).trim()).join('\n');
  const recipe = ruleFallback(title, combined);
  return { recipe, via: 'rule', insufficient: recipe.insufficient, reason: recipe.reason };
}

module.exports = { organizeRecipe, ruleFallback };
