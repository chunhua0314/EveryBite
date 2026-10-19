// 存储层：优先 better-sqlite3，加载失败时回退到 JSON 文件存储，接口一致
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const now = () => new Date().toISOString();

function safeParse(s, fallback) {
  if (Array.isArray(s)) return s;
  try { return JSON.parse(s); } catch { return fallback; }
}

function normalizeRecipe(row, tagNames) {
  return {
    id: row.id,
    title: row.title || '',
    subtitle: row.subtitle || '',
    summary: row.summary || '',
    category: row.category || '',
    source_url: row.source_url || '',
    cover: row.cover || '',
    cover_local: row.cover_local || '',
    duration: row.duration || '',
    difficulty: row.difficulty || '',
    taste: row.taste || '',
    main_ingredient: row.main_ingredient || '',
    ingredients: safeParse(row.ingredients, []),
    seasonings: safeParse(row.seasonings, []),
    steps: safeParse(row.steps, []),
    notes: row.notes || '',
    rating: row.rating || 0,
    rating_memo: row.rating_memo || '',
    raw_text: row.raw_text || '',
    tags: tagNames || [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const RECIPE_COLS = ['title', 'subtitle', 'summary', 'category', 'source_url', 'cover', 'cover_local',
  'duration', 'difficulty', 'taste', 'main_ingredient', 'ingredients', 'seasonings',
  'steps', 'notes', 'rating', 'rating_memo', 'raw_text'];

function pickRecipeData(data) {
  const out = {};
  for (const k of RECIPE_COLS) {
    if (data[k] === undefined) continue;
    out[k] = ['ingredients', 'seasonings', 'steps'].includes(k)
      ? JSON.stringify(data[k] || []) : data[k];
  }
  return out;
}

function createSqliteStore() {
  const Database = require('better-sqlite3');
  const db = new Database(path.join(DATA_DIR, 'recipes.db'));
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT, subtitle TEXT, summary TEXT,
      source_url TEXT, cover TEXT, cover_local TEXT,
      duration TEXT, difficulty TEXT, taste TEXT, main_ingredient TEXT,
      ingredients TEXT, seasonings TEXT, steps TEXT,
      notes TEXT, rating INTEGER DEFAULT 0, rating_memo TEXT,
      raw_text TEXT, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS tags(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS recipe_tags(recipe_id INTEGER, tag_id INTEGER,
      PRIMARY KEY(recipe_id, tag_id));
    CREATE TABLE IF NOT EXISTS assets(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT, category TEXT, source TEXT, recipe_id INTEGER,
      use_count INTEGER DEFAULT 0, created_at TEXT
    );
  `);
  // 老库补列
  const cols = db.prepare(`PRAGMA table_info(recipes)`).all().map(c => c.name);
  const addCol = (name) => { if (!cols.includes(name)) db.exec(`ALTER TABLE recipes ADD COLUMN ${name} TEXT`); };
  ['subtitle', 'summary', 'cover_local', 'duration', 'difficulty', 'taste', 'main_ingredient', 'category'].forEach(addCol);

  const getTagNames = (recipeId) =>
    db.prepare(`SELECT t.name FROM tags t JOIN recipe_tags rt ON rt.tag_id=t.id WHERE rt.recipe_id=? ORDER BY t.name`)
      .all(recipeId).map(r => r.name);

  function setTags(recipeId, tagNames) {
    db.prepare('DELETE FROM recipe_tags WHERE recipe_id=?').run(recipeId);
    const insTag = db.prepare('INSERT OR IGNORE INTO tags(name) VALUES (?)');
    const findTag = db.prepare('SELECT id FROM tags WHERE name=?');
    const insRT = db.prepare('INSERT OR IGNORE INTO recipe_tags(recipe_id, tag_id) VALUES (?,?)');
    for (const name of tagNames || []) {
      const n = String(name).trim();
      if (!n) continue;
      insTag.run(n);
      insRT.run(recipeId, findTag.get(n).id);
    }
    db.prepare(`DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM recipe_tags)`).run();
  }

  return {
    kind: 'sqlite',
    list({ tag, q, category } = {}) {
      let sql = 'SELECT DISTINCT r.* FROM recipes r';
      const params = [];
      const tags = tag ? (Array.isArray(tag) ? tag : String(tag).split(',')).filter(Boolean) : [];
      if (tags.length) {
        sql += ` JOIN recipe_tags rt ON rt.recipe_id=r.id JOIN tags t ON t.id=rt.tag_id AND t.name IN (${tags.map(() => '?').join(',')})`;
        params.push(...tags);
      }
      const conds = [];
      if (category) {
        conds.push('r.category = ?');
        params.push(String(category));
      }
      if (q) {
        conds.push(`(r.title LIKE ? OR r.ingredients LIKE ? OR r.seasonings LIKE ?)`);
        const like = `%${q}%`;
        params.push(like, like, like);
      }
      if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
      sql += ' ORDER BY r.updated_at DESC';
      return db.prepare(sql).all(...params).map(r => normalizeRecipe(r, getTagNames(r.id)));
    },
    get(id) {
      const row = db.prepare('SELECT * FROM recipes WHERE id=?').get(id);
      return row ? normalizeRecipe(row, getTagNames(id)) : null;
    },
    create(data) {
      const t = now();
      const d = pickRecipeData(data);
      const keys = [...Object.keys(d), 'created_at', 'updated_at'];
      const info = db.prepare(`INSERT INTO recipes(${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
        .run(...Object.values(d), t, t);
      setTags(info.lastInsertRowid, data.tags);
      return this.get(info.lastInsertRowid);
    },
    update(id, patch) {
      const cur = this.get(id);
      if (!cur) return null;
      const d = pickRecipeData(patch);
      const keys = Object.keys(d);
      if (keys.length) {
        db.prepare(`UPDATE recipes SET ${keys.map(k => `${k}=?`).join(',')}, updated_at=? WHERE id=?`)
          .run(...keys.map(k => d[k]), now(), id);
      } else {
        db.prepare('UPDATE recipes SET updated_at=? WHERE id=?').run(now(), id);
      }
      if (patch.tags !== undefined) setTags(id, patch.tags);
      return this.get(id);
    },
    remove(id) {
      db.prepare('DELETE FROM recipe_tags WHERE recipe_id=?').run(id);
      const info = db.prepare('DELETE FROM recipes WHERE id=?').run(id);
      db.prepare(`DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM recipe_tags)`).run();
      return info.changes > 0;
    },
    listTags() {
      return db.prepare('SELECT name FROM tags ORDER BY name').all().map(r => r.name);
    },
    listCategories() {
      return db.prepare(`SELECT category AS name, COUNT(*) AS count FROM recipes WHERE category IS NOT NULL AND category != '' GROUP BY category ORDER BY count DESC, name`).all();
    },
    // ---- 素材库 ----
    listAssets(category) {
      if (category) {
        return db.prepare('SELECT * FROM assets WHERE category=? ORDER BY id DESC').all(category);
      }
      return db.prepare('SELECT * FROM assets ORDER BY id DESC').all();
    },
    createAsset(data) {
      const info = db.prepare('INSERT INTO assets(path,category,source,recipe_id,use_count,created_at) VALUES (?,?,?,?,0,?)')
        .run(data.path || '', data.category || '', data.source || 'manual', data.recipe_id || null, now());
      return db.prepare('SELECT * FROM assets WHERE id=?').get(info.lastInsertRowid);
    },
    getAsset(id) {
      return db.prepare('SELECT * FROM assets WHERE id=?').get(id) || null;
    },
    touchAsset(id) {
      db.prepare('UPDATE assets SET use_count=use_count+1 WHERE id=?').run(id);
    },
  };
}

function createJsonStore() {
  const file = path.join(DATA_DIR, 'recipes.json');
  let state = { seq: 0, aseq: 0, recipes: [], assets: [] };
  if (fs.existsSync(file)) {
    try { state = { aseq: 0, assets: [], ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { /* 重新建 */ }
  }
  const save = () => fs.writeFileSync(file, JSON.stringify(state, null, 2));

  return {
    kind: 'json',
    list({ tag, q, category } = {}) {
      const tags = tag ? (Array.isArray(tag) ? tag : String(tag).split(',')).filter(Boolean) : [];
      let rows = state.recipes.slice();
      if (category) rows = rows.filter(r => r.category === String(category));
      if (tags.length) rows = rows.filter(r => tags.some(t => (r.tags || []).includes(t)));
      if (q) {
        const s = String(q).toLowerCase();
        rows = rows.filter(r =>
          (r.title || '').toLowerCase().includes(s) ||
          JSON.stringify(r.ingredients || []).toLowerCase().includes(s) ||
          JSON.stringify(r.seasonings || []).toLowerCase().includes(s));
      }
      return rows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    },
    get(id) {
      return state.recipes.find(r => r.id === Number(id)) || null;
    },
    create(data) {
      const t = now();
      const recipe = {
        id: ++state.seq,
        title: '', subtitle: '', summary: '', category: '', source_url: '', cover: '', cover_local: '',
        duration: '', difficulty: '', taste: '', main_ingredient: '',
        ingredients: [], seasonings: [], steps: [], notes: '', rating: 0,
        rating_memo: '', raw_text: '', tags: [], created_at: t, updated_at: t,
      };
      for (const k of RECIPE_COLS) if (data[k] !== undefined) recipe[k] = data[k];
      recipe.tags = (data.tags || []).map(x => String(x).trim()).filter(Boolean);
      state.recipes.push(recipe);
      save();
      return recipe;
    },
    update(id, patch) {
      const r = this.get(id);
      if (!r) return null;
      for (const k of RECIPE_COLS) if (patch[k] !== undefined) r[k] = patch[k];
      if (patch.tags !== undefined) r.tags = patch.tags.map(x => String(x).trim()).filter(Boolean);
      r.updated_at = now();
      save();
      return r;
    },
    remove(id) {
      const i = state.recipes.findIndex(r => r.id === Number(id));
      if (i < 0) return false;
      state.recipes.splice(i, 1);
      save();
      return true;
    },
    listTags() {
      const set = new Set();
      state.recipes.forEach(r => (r.tags || []).forEach(t => set.add(t)));
      return [...set].sort();
    },
    listCategories() {
      const counts = {};
      state.recipes.forEach(r => { if (r.category) counts[r.category] = (counts[r.category] || 0) + 1; });
      return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    },
    listAssets(category) {
      let rows = state.assets.slice();
      if (category) rows = rows.filter(a => a.category === category);
      return rows.sort((a, b) => b.id - a.id);
    },
    createAsset(data) {
      const asset = {
        id: ++state.aseq, path: data.path || '', category: data.category || '',
        source: data.source || 'manual', recipe_id: data.recipe_id || null,
        use_count: 0, created_at: now(),
      };
      state.assets.push(asset);
      save();
      return asset;
    },
    getAsset(id) {
      return state.assets.find(a => a.id === Number(id)) || null;
    },
    touchAsset(id) {
      const a = this.getAsset(id);
      if (a) { a.use_count += 1; save(); }
    },
  };
}

let store;
try {
  store = createSqliteStore();
  console.log('[store] 使用 SQLite (recipes.db)');
} catch (e) {
  console.warn('[store] better-sqlite3 不可用，回退 JSON 文件存储 (recipes.json):', e.message);
  store = createJsonStore();
}

module.exports = store;
