import React, { useRef, useState } from 'react';
import { api } from '../api.js';
import { Stars, Cover } from '../components.jsx';

const SORT_OPTIONS = [
  ['updated', '最近更新'],
  ['rating', '星级最高'],
  ['created', '最近收藏'],
];

export default function Home({ recipes, allTags, categories = [], selectedCategory, onSelectCategory,
  selectedTags, onToggleTag, q, setQ, sort, setSort, onOpen, onChanged, onError, onToast }) {

  const [renaming, setRenaming] = useState(null); // recipe 对象
  const [renameText, setRenameText] = useState('');
  const [showData, setShowData] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef(null);
  const lpTimer = useRef(null);
  const lpFired = useRef(false);

  const onImportFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('导入将覆盖当前全部数据（当前数据会自动备份到电脑 backups/ 目录），确定继续？')) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/backup/import', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `导入失败（HTTP ${res.status}）`);
      setShowData(false);
      onChanged();
      if (onToast) onToast(`已导入 ${data.recipes} 条菜谱`);
    } catch (err) {
      if (onError) onError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const startRename = (r) => { setRenaming(r); setRenameText(r.title); };
  const submitRename = async () => {
    const v = renameText.trim();
    const r = renaming;
    setRenaming(null);
    if (!v || v === r.title) return;
    try {
      await api.updateRecipe(r.id, { title: v });
      onChanged();
    } catch (e) {
      if (onError) onError(e.message);
    }
  };

  const lpStart = (r) => {
    lpFired.current = false;
    lpTimer.current = setTimeout(() => {
      lpTimer.current = null;
      lpFired.current = true;
      startRename(r);
    }, 500);
  };
  const lpCancel = () => {
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; }
  };

  return (
    <section>
      <div className="flex items-baseline justify-between px-0.5 pt-5 pb-3.5">
        <h2 className="font-serif text-2xl font-extrabold text-ink">我的菜谱</h2>
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted">共 {recipes.length} 道</span>
          <button
            className="w-8 h-8 rounded-full bg-card shadow-soft text-[14px] text-ink2 flex items-center justify-center"
            title="数据管理"
            onClick={() => setShowData(true)}
          >⚙️</button>
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2 bg-card rounded-full px-4 py-2.5 text-[13px] text-muted shadow-soft">
          <span>🔍</span>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="搜索菜名 / 食材，如「鸡翅」"
            className="flex-1 bg-transparent outline-none text-ink placeholder:text-muted"
          />
          {q && <button onClick={() => setQ('')} className="text-muted">✕</button>}
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="shrink-0 bg-card border border-line rounded-full text-[12.5px] text-ink2 px-3 py-2.5 outline-none shadow-soft appearance-none cursor-pointer"
        >
          {SORT_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>

      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-0.5 pb-2 md:flex-wrap items-center">
          <span className="shrink-0 text-[11px] text-muted">主分类</span>
          <button
            className={`shrink-0 border text-[12.5px] px-3.5 py-[7px] rounded-full ${!selectedCategory ? 'bg-olive border-olive text-white font-semibold' : 'border-line bg-card text-ink2'}`}
            onClick={() => onSelectCategory('')}
          >全部</button>
          {categories.map(c => {
            const on = selectedCategory === c.name;
            return (
              <button
                key={c.name}
                className={`shrink-0 border text-[12.5px] px-3.5 py-[7px] rounded-full ${on ? 'bg-olive border-olive text-white font-semibold' : 'border-line bg-card text-ink2'}`}
                onClick={() => onSelectCategory(on ? '' : c.name)}
              >{c.name}<span className="opacity-60 ml-0.5">{c.count}</span></button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar px-0.5 pb-4 md:flex-wrap">
        <button
          className={`shrink-0 border text-[12.5px] px-3.5 py-[7px] rounded-full ${!selectedTags.length ? 'bg-olive border-olive text-white font-semibold' : 'border-line bg-card text-ink2'}`}
          onClick={() => onToggleTag(null)}
        >全部</button>
        {allTags.map(t => {
          const on = selectedTags.includes(t);
          return (
            <button
              key={t}
              className={`shrink-0 border text-[12.5px] px-3.5 py-[7px] rounded-full ${on ? 'bg-olive border-olive text-white font-semibold' : 'border-line bg-card text-ink2'}`}
              onClick={() => onToggleTag(t)}
            >{t}</button>
          );
        })}
      </div>

      {recipes.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🥘</div>
          <p className="font-serif text-lg font-bold text-ink mb-2">还没有菜谱</p>
          <p className="text-[13px] text-muted leading-relaxed">
            去小红书复制一个做饭视频链接<br />点下方「＋ 添加」粘贴进来
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-[18px]">
          {recipes.map((r, idx) => (
            <div
              key={r.id}
              className="group relative bg-card rounded-card overflow-hidden cursor-pointer shadow-soft md:hover:-translate-y-[3px] md:hover:shadow-lift transition-all"
              onClick={() => { if (!lpFired.current) onOpen(r.id); lpFired.current = false; }}
              onTouchStart={() => lpStart(r)}
              onTouchEnd={lpCancel}
              onTouchMove={lpCancel}
              onMouseDown={() => lpStart(r)}
              onMouseUp={lpCancel}
              onMouseLeave={lpCancel}
            >
              <button
                className="absolute top-2 right-2 z-10 hidden md:group-hover:flex w-7 h-7 rounded-full bg-card/90 shadow-soft text-[12px] items-center justify-center text-ink2 hover:text-olive"
                title="重命名"
                onClick={e => { e.stopPropagation(); startRename(r); }}
                onMouseDown={e => e.stopPropagation()}
              >✏️</button>
              <div className="relative">
                <Cover recipe={r} className="aspect-[4/3]" />
                <span className="absolute top-2 left-3 font-serif text-[15px] font-bold text-ink/35 bg-card/70 rounded px-1">
                  {String(idx + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="px-3.5 pt-2.5 pb-3">
                <div className="font-serif text-[15px] font-bold text-ink mb-1.5 truncate">{r.title}</div>
                <div className="flex gap-1 flex-wrap mb-1.5 min-h-[20px]">
                  {(r.tags || []).slice(0, 3).map(t => (
                    <span key={t} className="text-[10.5px] text-olive bg-olive-soft rounded-full px-2 py-[2.5px]">{t}</span>
                  ))}
                </div>
                <Stars value={r.rating} size="text-[13px]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 数据管理弹窗 */}
      {showData && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-6"
          onClick={() => !importing && setShowData(false)}
        >
          <div
            className="bg-card rounded-card shadow-lift p-5 w-full max-w-[340px]"
            onClick={e => e.stopPropagation()}
          >
            <div className="font-serif text-[17px] font-extrabold text-ink mb-4">数据管理</div>

            <a
              href="/api/backup/export"
              download
              className="block w-full text-center bg-olive text-white text-sm font-semibold py-3 rounded-full mb-2"
            >📦 导出备份</a>
            <p className="text-[11.5px] text-muted leading-relaxed mb-4 px-0.5">
              数据库 + 封面打包下载，约几 MB。换电脑部署时用这个文件恢复。
            </p>

            <button
              className="w-full bg-bg text-ink2 text-sm font-semibold py-3 rounded-full mb-2 disabled:opacity-50"
              onClick={() => importRef.current && importRef.current.click()}
              disabled={importing}
            >{importing ? '导入中…' : '📥 导入备份'}</button>
            <input ref={importRef} type="file" accept=".zip" className="hidden" onChange={onImportFile} />
            {importing && (
              <div className="flex items-center gap-2 text-[12px] text-ink2 py-1 justify-center">
                <span className="spinner"></span><span>正在导入，请勿关闭…</span>
              </div>
            )}
            <p className="text-[11.5px] text-muted leading-relaxed px-0.5">
              导入会覆盖当前全部数据，当前数据会自动备份到电脑 backups/ 目录。
            </p>

            <button
              className="w-full text-muted text-[13px] mt-4"
              onClick={() => setShowData(false)}
              disabled={importing}
            >关闭</button>
          </div>
        </div>
      )}

      {/* 重命名弹窗 */}
      {renaming && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-6"
          onClick={() => setRenaming(null)}
        >
          <div
            className="bg-card rounded-card shadow-lift p-5 w-full max-w-[320px]"
            onClick={e => e.stopPropagation()}
          >
            <div className="font-serif text-[17px] font-extrabold text-ink mb-3">重命名</div>
            <input
              autoFocus
              value={renameText}
              onChange={e => setRenameText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(null); }}
              className="w-full border-[1.5px] border-line rounded-xl px-3.5 py-3 text-sm outline-none bg-white text-ink focus:border-olive mb-4"
            />
            <div className="flex gap-2.5">
              <button
                className="flex-1 bg-bg text-ink2 text-sm font-semibold py-2.5 rounded-full"
                onClick={() => setRenaming(null)}
              >取消</button>
              <button
                className="flex-1 bg-olive text-white text-sm font-semibold py-2.5 rounded-full"
                onClick={submitRename}
              >保存</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
