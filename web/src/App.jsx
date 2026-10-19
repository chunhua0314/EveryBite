import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { Toast } from './components.jsx';
import Home from './pages/Home.jsx';
import Add from './pages/Add.jsx';
import Preview from './pages/Preview.jsx';
import Detail from './pages/Detail.jsx';

export default function App() {
  const [view, setView] = useState({ name: 'home' });
  const [recipes, setRecipes] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const mainRef = useRef(null);
  const toastTimer = useRef(null);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 1800);
  }, []);
  const onError = useCallback((msg) => toast(msg), [toast]);

  const refresh = useCallback(async () => {
    try {
      const [list, tags] = await Promise.all([
        api.listRecipes({ q, tags: selectedTags }),
        api.listTags(),
      ]);
      setRecipes(list);
      setAllTags(tags);
    } catch (e) {
      onError(e.message);
    }
  }, [q, selectedTags, onError]);

  useEffect(() => { refresh(); }, [refresh]);

  // 详情页返回后刷新列表（星级/标签可能变了）
  const go = useCallback((name, id) => {
    if (name === 'home' && view.name === 'detail') refresh();
    setView({ name, id });
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [view.name, refresh]);

  const toggleTag = (t) => {
    if (t === null) setSelectedTags([]);
    else setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const navHome = view.name === 'home' || view.name === 'detail';
  const navBtn = (name, icon, label, on) => (
    <button
      key={name}
      className={`flex-1 md:flex-none md:w-full md:text-left md:px-3 md:py-[11px] md:rounded-xl text-[11px] md:text-sm flex flex-col md:flex-row items-center md:gap-2.5 gap-[3px] ${on ? 'text-olive font-semibold md:bg-olive-soft' : 'text-muted md:text-ink2'}`}
      onClick={() => go(name)}
    >
      <span className="text-xl md:text-base">{icon}</span>{label}
    </button>
  );

  return (
    <div className="h-full flex bg-bg">
      {/* 桌面侧边栏 */}
      <aside className="hidden md:flex w-[212px] bg-card border-r border-line flex-col py-6 px-3.5 shrink-0">
        <div className="font-serif text-xl font-extrabold text-ink px-2.5 pb-1">我的菜谱</div>
        <div className="text-[10px] text-muted tracking-[2px] px-2.5 pb-5">MY RECIPE BOOK</div>
        <nav className="flex flex-col gap-1">
          {navBtn('home', '🏠', '菜谱库', navHome)}
          {navBtn('add', '➕', '添加菜谱', !navHome)}
        </nav>
        <div className="mt-6 px-2.5">
          <h4 className="text-xs text-muted mb-2.5 font-medium">全部标签</h4>
          <span
            className={`inline-block mr-1.5 mb-2 text-xs px-2.5 py-[5px] rounded-full cursor-pointer ${!selectedTags.length ? 'bg-olive text-white' : 'bg-bg text-ink2'}`}
            onClick={() => toggleTag(null)}
          >全部</span>
          {allTags.map(t => (
            <span
              key={t}
              className={`inline-block mr-1.5 mb-2 text-xs px-2.5 py-[5px] rounded-full cursor-pointer ${selectedTags.includes(t) ? 'bg-olive text-white' : 'bg-bg text-ink2'}`}
              onClick={() => { toggleTag(t); if (view.name !== 'home') go('home'); }}
            >{t}</span>
          ))}
        </div>
      </aside>

      {/* 主区域 */}
      <div className="flex-1 relative min-w-0 flex flex-col">
        <main ref={mainRef} className="flex-1 overflow-y-auto px-4 pb-24 md:px-8 md:pt-6 md:pb-11">
          {view.name === 'home' && (
            <Home
              recipes={recipes}
              allTags={allTags}
              selectedTags={selectedTags}
              onToggleTag={toggleTag}
              q={q}
              setQ={setQ}
              onOpen={id => go('detail', id)}
            />
          )}
          {view.name === 'add' && (
            <Add
              onParsed={p => { setPreview(p); go('preview'); }}
              onError={onError}
            />
          )}
          {view.name === 'preview' && preview && (
            <Preview
              preview={preview}
              setPreview={setPreview}
              onBack={() => go('add')}
              onSaved={() => { refresh(); go('home'); }}
              onError={onError}
              toast={toast}
            />
          )}
          {view.name === 'detail' && (
            <Detail
              id={view.id}
              onBack={() => go('home')}
              onDeleted={() => { refresh(); go('home'); }}
              onError={onError}
              toast={toast}
            />
          )}
        </main>

        {/* 手机底部 Tab */}
        <nav className="md:hidden absolute left-0 right-0 bottom-0 bg-card border-t border-line flex pt-2" style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
          {navBtn('home', '🏠', '菜谱库', navHome)}
          {navBtn('add', '➕', '添加', !navHome)}
        </nav>
      </div>

      <Toast msg={toastMsg} />
    </div>
  );
}
