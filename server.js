require('dotenv').config();
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const store = require('./src/store');
const { scrapeNote } = require('./src/scrape');
const { organizeRecipe } = require('./src/ai');

const COVERS_DIR = path.join(__dirname, 'covers');
if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });

// 下载封面到本地 covers/ 并登记素材库；失败不阻塞主流程
async function saveCoverToAssets(coverUrl) {
  try {
    if (!coverUrl || !/^https?:\/\//.test(coverUrl)) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(coverUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Referer': 'https://www.xiaohongshu.com/',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    const ctype = res.headers.get('content-type') || '';
    const ext = ctype.includes('png') ? '.png' : ctype.includes('webp') ? '.webp'
      : ctype.includes('gif') ? '.gif' : '.jpg';
    const fname = `cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    fs.writeFileSync(path.join(COVERS_DIR, fname), buf);
    const asset = store.createAsset({ path: `covers/${fname}`, category: 'cover', source: 'note' });
    return asset;
  } catch (e) {
    console.warn('[cover] 封面下载失败:', e.message);
    return null;
  }
}

const app = express();
app.use(express.json({ limit: '2mb' }));

// ---------- API ----------
app.post('/api/parse', async (req, res) => {
  try {
    const { url, title, text, referenceText } = req.body || {};
    let noteTitle = title || '';
    let noteText = text || '';
    let cover = '';
    let coverLocal = '';
    let sourceUrl = '';
    let noteTags = [];

    if (url && String(url).trim()) {
      const note = await scrapeNote(String(url).trim());
      noteTitle = noteTitle || note.title;
      noteText = noteText || note.desc;
      cover = note.cover;
      sourceUrl = note.sourceUrl || String(url).trim();
      noteTags = note.tags || [];
      const asset = await saveCoverToAssets(cover);
      if (asset) coverLocal = asset.path;
    } else if (!noteText.trim() && !(referenceText && String(referenceText).trim())) {
      return res.status(400).json({ error: '请提供 url 或 {title, text}' });
    }

    const { recipe, via, insufficient, reason } = await organizeRecipe({
      title: noteTitle,
      text: noteText,
      referenceText: referenceText ? String(referenceText) : '',
    });
    // 笔记自带标签只作补充：不与 AI 标签重复、总数不超 4，避免标签爆炸
    if (noteTags.length) {
      const merged = [...recipe.tags];
      for (const t of noteTags) {
        if (merged.length >= 4) break;
        if (!merged.includes(t)) merged.push(t);
      }
      recipe.tags = merged;
    }
    res.json({
      title: recipe.title,
      subtitle: recipe.subtitle,
      summary: recipe.summary,
      category: recipe.category,
      duration: recipe.duration,
      difficulty: recipe.difficulty,
      taste: recipe.taste,
      main_ingredient: recipe.main_ingredient,
      source_url: sourceUrl,
      cover,
      cover_local: coverLocal,
      ingredients: recipe.ingredients,
      seasonings: recipe.seasonings,
      steps: recipe.steps,
      notes: recipe.notes,
      tags: recipe.tags,
      raw_text: noteText,
      via,
      insufficient: !!insufficient,
      reason: reason || '',
    });
  } catch (e) {
    console.error('[parse]', e.message);
    res.status(502).json({ error: e.message || '解析失败，请改用「粘贴文字」' });
  }
});

app.get('/api/recipes', (req, res) => {
  const { tag, q, category, sort } = req.query;
  res.json(store.list({ tag, q, category, sort }));
});

app.get('/api/recipes/:id', (req, res) => {
  const recipe = store.get(Number(req.params.id));
  if (!recipe) return res.status(404).json({ error: '菜谱不存在' });
  res.json(recipe);
});

app.post('/api/recipes', (req, res) => {
  const data = req.body || {};
  if (!data.title || !String(data.title).trim()) {
    return res.status(400).json({ error: '菜名不能为空' });
  }
  const recipe = store.create(data);
  res.status(201).json(recipe);
});

app.patch('/api/recipes/:id', (req, res) => {
  const allowed = ['title', 'subtitle', 'summary', 'category', 'source_url', 'cover', 'cover_local',
    'duration', 'difficulty', 'taste', 'main_ingredient',
    'ingredients', 'seasonings', 'steps', 'notes', 'rating', 'rating_memo', 'raw_text', 'tags'];
  const patch = {};
  for (const k of allowed) {
    if (req.body && req.body[k] !== undefined) patch[k] = req.body[k];
  }
  const recipe = store.update(Number(req.params.id), patch);
  if (!recipe) return res.status(404).json({ error: '菜谱不存在' });
  res.json(recipe);
});

app.delete('/api/recipes/:id', (req, res) => {
  const ok = store.remove(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: '菜谱不存在' });
  res.json({ ok: true });
});

app.get('/api/tags', (req, res) => {
  res.json(store.listTags());
});

app.get('/api/categories', (req, res) => {
  res.json(store.listCategories());
});

// ---------- 数据备份与恢复 ----------
const DATA_DIR = path.join(__dirname, 'src', 'data');
const BACKUPS_DIR = path.join(__dirname, 'backups');

function timestampName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

app.get('/api/backup/export', async (req, res) => {
  const tmpSnapshot = path.join(os.tmpdir(), `everybite-snapshot-${Date.now()}.db`);
  try {
    const zip = new AdmZip();
    if (store.kind === 'sqlite') {
      await store.backupTo(tmpSnapshot); // SQLite 在线快照
      zip.addLocalFile(tmpSnapshot, 'src/data', 'recipes.db');
    } else {
      zip.addLocalFile(path.join(DATA_DIR, 'recipes.json'), 'src/data', 'recipes.json');
    }
    if (fs.existsSync(COVERS_DIR)) zip.addLocalFolder(COVERS_DIR, 'covers');
    const fname = `EveryBite-backup-${timestampName()}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(zip.toBuffer());
  } catch (e) {
    console.error('[backup] 导出失败:', e.message);
    res.status(500).json({ error: `导出失败：${e.message}` });
  } finally {
    fs.unlink(tmpSnapshot, () => {});
  }
});

const importUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, fs.mkdtempSync(path.join(os.tmpdir(), 'eb-import-'))),
    filename: (req, file, cb) => cb(null, 'backup.zip'),
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.zip$/i.test(file.originalname) || /zip/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('只支持 zip 备份文件'));
  },
});

app.post('/api/backup/import', (req, res) => {
  importUpload.single('file')(req, res, async (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? '备份文件不能超过 200MB' : (err.message || '上传失败');
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: '没有收到备份文件' });
    const zipPath = req.file.path;
    const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-extract-'));
    const cleanup = () => {
      fs.rm(extractDir, { recursive: true, force: true }, () => {});
      fs.rm(path.dirname(zipPath), { recursive: true, force: true }, () => {});
    };
    try {
      // 1. 解压并校验（校验不过不改动任何现有数据）
      try {
        new AdmZip(zipPath).extractAllTo(extractDir, true);
      } catch (ze) {
        cleanup();
        return res.status(400).json({ error: '备份文件无效：不是可识别的 zip 文件，未改动任何数据' });
      }
      const dataSrc = path.join(extractDir, 'src', 'data');
      const hasDb = fs.existsSync(path.join(dataSrc, 'recipes.db'));
      const hasJson = fs.existsSync(path.join(dataSrc, 'recipes.json'));
      if (!hasDb && !hasJson) {
        cleanup();
        return res.status(400).json({ error: '备份文件无效：缺少 src/data/recipes.db（或 recipes.json），未改动任何数据' });
      }
      const coversSrc = path.join(extractDir, 'covers');
      const hasCovers = fs.existsSync(coversSrc);

      // 2. 导入前完整备份当前数据
      const stamp = `before-import-${Date.now()}`;
      const snapshotDir = path.join(BACKUPS_DIR, stamp);
      fs.mkdirSync(snapshotDir, { recursive: true });
      if (fs.existsSync(DATA_DIR)) fs.cpSync(DATA_DIR, path.join(snapshotDir, 'data'), { recursive: true });
      if (fs.existsSync(COVERS_DIR)) fs.cpSync(COVERS_DIR, path.join(snapshotDir, 'covers'), { recursive: true });

      // 3. 关闭旧连接 → 清旧放新 → 重新初始化
      if (typeof store.close === 'function') store.close();
      for (const f of ['recipes.db', 'recipes.db-wal', 'recipes.db-shm', 'recipes.json']) {
        fs.rmSync(path.join(DATA_DIR, f), { force: true });
      }
      fs.rmSync(COVERS_DIR, { recursive: true, force: true });
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.mkdirSync(COVERS_DIR, { recursive: true });
      fs.cpSync(dataSrc, DATA_DIR, { recursive: true });
      if (hasCovers) fs.cpSync(coversSrc, COVERS_DIR, { recursive: true });
      // WAL 残留防御性清理
      for (const f of ['recipes.db-wal', 'recipes.db-shm']) {
        fs.rmSync(path.join(DATA_DIR, f), { force: true });
      }
      store.reinit();

      const recipes = store.list({});
      const assets = store.listAssets();
      cleanup();
      res.json({ ok: true, recipes: recipes.length, assets: assets.length });
    } catch (e) {
      console.error('[backup] 导入失败:', e.message);
      cleanup();
      try { store.reinit(); } catch { /* 尽力恢复 */ }
      res.status(500).json({ error: `导入失败：${e.message}` });
    }
  });
});

// ---------- 素材库 ----------
app.get('/api/assets', (req, res) => {
  res.json(store.listAssets(req.query.category));
});

// 上传手机相册图片做封面
const upload = multer({
  storage: multer.diskStorage({
    destination: COVERS_DIR,
    filename: (req, file, cb) => {
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[file.mimetype] || '.jpg';
      cb(null, `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('只支持 jpg/png/webp/gif 图片'));
  },
});

app.post('/api/recipes/:id/cover-upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? '图片不能超过 10MB' : (err.message || '上传失败');
      return res.status(400).json({ error: msg });
    }
    const id = Number(req.params.id);
    const recipe = store.get(id);
    if (!recipe) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: '菜谱不存在' });
    }
    if (!req.file) return res.status(400).json({ error: '没有收到图片文件' });
    const asset = store.createAsset({
      path: `covers/${req.file.filename}`,
      category: recipe.main_ingredient || 'upload',
      source: 'manual',
      recipe_id: id,
    });
    store.touchAsset(asset.id);
    const updated = store.update(id, { cover_local: asset.path });
    res.json(updated);
  });
});

// 换封面：{assetId} 用素材库图片；{generate:true} AI 生图（占位，未实现）
app.post('/api/recipes/:id/cover', (req, res) => {  const id = Number(req.params.id);
  const recipe = store.get(id);
  if (!recipe) return res.status(404).json({ error: '菜谱不存在' });
  const { assetId, generate } = req.body || {};
  if (generate) {
    return res.status(501).json({ error: 'AI 生图暂未实现，请先从素材库选择封面' });
  }
  const asset = store.getAsset(Number(assetId));
  if (!asset) return res.status(404).json({ error: '素材不存在' });
  const updated = store.update(id, { cover_local: asset.path });
  store.touchAsset(asset.id);
  res.json(updated);
});

// ---------- 静态资源 ----------
app.use('/covers', express.static(COVERS_DIR));
// 安卓安装包：项目根目录存在 EveryBite.apk 时提供下载
app.get('/EveryBite.apk', (req, res) => {
  const apk = path.join(__dirname, 'EveryBite.apk');
  if (fs.existsSync(apk)) {
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="EveryBite.apk"');
    res.sendFile(apk);
  } else {
    res.status(404).send('尚未构建安装包，请先在电脑上编译 android/ 工程');
  }
});
const distDir = path.join(__dirname, 'web', 'dist');
app.use(express.static(distDir));
app.get(/^(?!\/api\/|\/covers\/).*/, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) res.status(503).send('前端尚未构建，请先在 web/ 目录执行 npm run build');
  });
});

const PORT = Number(process.env.PORT) || 3456;
app.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  console.log('');
  console.log('  菜谱卡服务已启动');
  console.log(`  本机访问:   http://localhost:${PORT}`);
  for (const ip of ips) {
    console.log(`  手机访问:   http://${ip}:${PORT}   <- 手机连同一 WiFi 后浏览器打开`);
  }
  if (!process.env.LLM_API_KEY) {
    console.log('  提示: 未配置 LLM_API_KEY，当前使用规则解析兜底（.env 中填入 Key 后自动启用 AI 整理）');
  }
  console.log('');
});
