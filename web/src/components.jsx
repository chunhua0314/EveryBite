import React, { useEffect, useRef, useState } from 'react';

export function Stars({ value = 0, size = 'text-base', onRate }) {
  return (
    <span className={`stars ${size} ${onRate ? 'cursor-pointer select-none' : ''}`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={i <= value ? 'on' : ''}
          onClick={onRate ? () => onRate(i === value ? 0 : i) : undefined}
        >★</span>
      ))}
    </span>
  );
}

export function BackFab({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="返回"
      className="fixed top-4 left-4 md:left-[232px] z-40 w-11 h-11 rounded-full bg-card shadow-lift text-ink2 text-[22px] leading-none flex items-center justify-center active:scale-95 transition-transform"
    >‹</button>
  );
}

export function Toast({ msg }) {  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-ink text-white text-[13px] px-5 py-2.5 rounded-full transition-transform duration-300 opacity-95 pointer-events-none ${msg ? 'translate-y-0' : '-translate-y-20'}`}
    >{msg || ''}</div>
  );
}

export function Cover({ recipe, className = '', emojiSize = 'text-[42px]', rounded = '' }) {
  const [err, setErr] = useState(false);
  const src = recipe.cover_local ? `/${recipe.cover_local}` : recipe.cover;
  if (!src || err) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-[#EDE8DB] to-[#E3E7D8] ${className} ${rounded}`}>
        <span className={emojiSize}>🍽️</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={recipe.title}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setErr(true)}
      className={`object-cover w-full ${className} ${rounded}`}
    />
  );
}

export function TagEditor({ tags, onChange, addPlaceholder = '＋ 添加标签' }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { if (adding && inputRef.current) inputRef.current.focus(); }, [adding]);

  const submit = () => {
    const v = text.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setText('');
    setAdding(false);
  };

  return (
    <div className="flex gap-1.5 flex-wrap items-center">
      {tags.map(t => (
        <span key={t} className="text-xs text-olive bg-olive-soft rounded-full px-3 py-1">
          {t}
          <button
            className="ml-1 text-olive/60 hover:text-olive"
            onClick={() => onChange(tags.filter(x => x !== t))}
            aria-label={`删除标签 ${t}`}
          >✕</button>
        </span>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={submit}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false); }}
          className="text-xs border border-olive-line rounded-full px-3 py-1 outline-none w-24 bg-white"
          placeholder="标签名"
        />
      ) : (
        <button
          className="text-xs text-muted bg-transparent border border-dashed border-olive-line rounded-full px-3 py-1"
          onClick={() => setAdding(true)}
        >{addPlaceholder}</button>
      )}
    </div>
  );
}

export function Accordion({ title, count, defaultOpen = false, children, className = '' }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setOpen(mq.matches ? true : defaultOpen);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [defaultOpen]);

  return (
    <div className={`bg-card rounded-card shadow-soft p-[18px] ${className}`}>
      <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setOpen(!open)}>
        <div className="font-serif text-[17px] font-extrabold text-ink flex items-center gap-2">
          {title}
          <span className="text-[11px] text-muted font-normal font-sans">{count} 项</span>
        </div>
        <span className={`text-muted text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </div>
      {open && <div className="pt-3">{children}</div>}
    </div>
  );
}

export function ListTable({ items, emptyText = '暂无' }) {
  if (!items || !items.length) return <div className="text-[13px] text-muted py-2">{emptyText}</div>;
  return (
    <table className="w-full border-collapse text-[13.5px]">
      <tbody>
        {items.map((it, i) => (
          <tr key={i} className="border-b border-[#F2F0E8] last:border-b-0">
            <td className="py-2 pr-2 text-ink2">{it.name}</td>
            <td className="py-2 text-right text-ink font-semibold whitespace-nowrap">{it.amount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
