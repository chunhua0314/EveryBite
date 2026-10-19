import React from 'react';
import { Stars, Cover } from '../components.jsx';

export default function Home({ recipes, allTags, categories = [], selectedCategory, onSelectCategory, selectedTags, onToggleTag, q, setQ, onOpen }) {
  return (
    <section>
      <div className="flex items-baseline justify-between px-0.5 pt-5 pb-3.5">
        <h2 className="font-serif text-2xl font-extrabold text-ink">我的菜谱</h2>
        <span className="text-xs text-muted">共 {recipes.length} 道</span>
      </div>

      <div className="flex items-center gap-2 bg-card rounded-full px-4 py-2.5 text-[13px] text-muted shadow-soft mb-3">
        <span>🔍</span>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="搜索菜名 / 食材，如「鸡翅」"
          className="flex-1 bg-transparent outline-none text-ink placeholder:text-muted"
        />
        {q && <button onClick={() => setQ('')} className="text-muted">✕</button>}
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
              className="bg-card rounded-card overflow-hidden cursor-pointer shadow-soft md:hover:-translate-y-[3px] md:hover:shadow-lift transition-all"
              onClick={() => onOpen(r.id)}
            >
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
    </section>
  );
}
