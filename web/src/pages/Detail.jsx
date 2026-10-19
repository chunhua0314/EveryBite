import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Stars, TagEditor, Cover, Accordion, ListTable } from '../components.jsx';

function TweakEditor({ initial, onSave, onCancel }) {
  const [text, setText] = useState(initial || '');
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  return (
    <div className="mt-2 bg-tweak-bg border-l-[3px] border-tweak-bar rounded-r-[10px] p-2">
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        rows={2}
        placeholder="记录你的调整，原文不会被覆盖…"
        className="w-full bg-transparent text-[12.5px] text-[#8a6d1a] outline-none resize-y leading-relaxed"
      />
      <div className="flex gap-3 justify-end">
        <button className="text-[12px] text-muted" onClick={onCancel}>取消</button>
        <button className="text-[12px] text-olive font-semibold" onClick={() => onSave(text.trim())}>保存</button>
      </div>
    </div>
  );
}

function CoverPicker({ recipe, onPatched, onClose, onError }) {
  const [assets, setAssets] = useState(null);
  useEffect(() => {
    api.listAssets('cover').then(setAssets).catch(e => onError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pick = async (assetId) => {
    try {
      const updated = await api.setCover(recipe.id, { assetId });
      onPatched(updated);
      onClose();
    } catch (e) { onError(e.message); }
  };
  const generate = async () => {
    try {
      await api.setCover(recipe.id, { generate: true });
    } catch (e) { onError(e.message); }
  };
  return (
    <div className="mt-2 border-t border-line pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] text-muted">从素材库选择封面</span>
        <div className="flex gap-3">
          <button className="text-[12px] text-olive" onClick={generate}>✨ AI 生图</button>
          <button className="text-[12px] text-muted" onClick={onClose}>收起</button>
        </div>
      </div>
      {assets === null ? (
        <div className="text-[12px] text-muted py-2">加载中…</div>
      ) : assets.length === 0 ? (
        <div className="text-[12px] text-muted py-2">素材库还没有图片，解析新笔记时会自动存入封面</div>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
          {assets.map(a => (
            <img
              key={a.id}
              src={`/${a.path}`}
              alt=""
              onClick={() => pick(a.id)}
              className="aspect-[4/3] object-cover rounded-lg cursor-pointer hover:ring-2 hover:ring-olive"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Detail({ id, onBack, onDeleted, onError, toast }) {
  const [recipe, setRecipe] = useState(null);
  const [memo, setMemo] = useState('');
  const [notes, setNotes] = useState('');
  const [editingStep, setEditingStep] = useState(-1);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const [categoryText, setCategoryText] = useState('');

  useEffect(() => {
    api.getRecipe(id).then(r => {
      setRecipe(r);
      setMemo(r.rating_memo || '');
      setNotes(r.notes || '');
    }).catch(e => onError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!recipe) return <div className="text-center text-muted text-sm py-20">加载中…</div>;

  const patch = async (obj, silent) => {
    setRecipe(r => ({ ...r, ...obj }));
    try {
      const updated = await api.updateRecipe(id, obj);
      setRecipe(updated);
      if (!silent) toast('已保存');
    } catch (e) {
      onError(e.message);
    }
  };

  const saveStepTweak = (idx, text) => {
    const steps = recipe.steps.map((s, i) => {
      if (i !== idx) return s;
      const next = { ...s };
      if (text) next.tweak = text; else delete next.tweak;
      return next;
    });
    setEditingStep(-1);
    patch({ steps }, true);
  };

  const del = async () => {
    if (!window.confirm(`确定删除「${recipe.title}」吗？此操作不可恢复。`)) return;
    try {
      await api.deleteRecipe(id);
      toast('已删除');
      onDeleted();
    } catch (e) { onError(e.message); }
  };

  const statItems = [
    ['⏱', '总时长', recipe.duration || '—'],
    ['📶', '难度', recipe.difficulty || '—'],
    ['🌶', '口味', recipe.taste || '—'],
    ['🍗', '主食材', recipe.main_ingredient || '—'],
    ['⭐', '我的评分', recipe.rating ? `${recipe.rating} 星` : '未评分'],
  ];
  const inlineStats = [
    recipe.duration && `⏱ ${recipe.duration}`,
    recipe.difficulty && `📶 ${recipe.difficulty}`,
    recipe.taste && `🌶 ${recipe.taste}`,
    recipe.main_ingredient && `🍗 ${recipe.main_ingredient}`,
    recipe.rating ? `⭐ ${recipe.rating} 星` : null,
  ].filter(Boolean);

  return (
    <section>
      <div className="flex items-center justify-between px-0.5 pt-5 pb-3.5">
        <button className="bg-card rounded-full px-3.5 py-2 text-[13px] text-ink2 shadow-soft" onClick={onBack}>‹ 返回</button>
        <span className="text-xs text-muted">{recipe.created_at ? `${String(recipe.created_at).slice(0, 10)} 收藏` : ''}</span>
      </div>

      <div className="detail-cols">
        {/* 头部卡片 */}
        <div className="a-hero bg-card rounded-card shadow-soft p-6 mb-3.5 md:mb-0 relative overflow-hidden">
          <div className="font-serif text-[44px] font-extrabold text-olive-line leading-none">
            {String(recipe.id).padStart(2, '0')}
          </div>
          <h1 className="font-serif text-[30px] font-extrabold text-ink mt-1 mb-0.5">{recipe.title}</h1>
          <div className="text-[11px] text-muted tracking-[2.5px] mb-3">{recipe.subtitle || ''}</div>
          {recipe.summary && <p className="text-[13px] text-ink2 leading-[1.9] mb-3.5">{recipe.summary}</p>}
          <div className="flex gap-1.5 flex-wrap items-center">
            {editingCategory ? (
              <input
                autoFocus
                value={categoryText}
                onChange={e => setCategoryText(e.target.value)}
                onBlur={() => {
                  setEditingCategory(false);
                  const v = categoryText.trim();
                  if (v !== (recipe.category || '')) patch({ category: v }, true);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.target.blur();
                  if (e.key === 'Escape') setEditingCategory(false);
                }}
                className="text-xs border border-olive rounded-full px-3 py-1 outline-none w-24 bg-white text-olive font-semibold"
                placeholder="如 川菜"
              />
            ) : (
              <button
                className="text-xs font-semibold rounded-full px-3 py-1 bg-olive text-white"
                onClick={() => { setCategoryText(recipe.category || ''); setEditingCategory(true); }}
                title="点击编辑主分类"
              >{recipe.category || '＋ 主分类'}</button>
            )}
            <TagEditor
              tags={recipe.tags || []}
              onChange={tags => patch({ tags }, true)}
              addPlaceholder="＋"
            />
          </div>
          {inlineStats.length > 0 && (
            <div className="hidden md:flex flex-wrap mt-3.5 text-[12.5px] text-ink2">
              {inlineStats.map((s, i) => (
                <span key={i} className="pr-2.5 mr-2.5 border-r border-line last:border-r-0 last:mr-0 last:pr-0 whitespace-nowrap">{s}</span>
              ))}
            </div>
          )}
          <div className="mt-3.5">
            <Cover recipe={recipe} className="aspect-video" emojiSize="text-[56px]" rounded="rounded-[14px]" />
            <button
              className="text-[12px] text-muted mt-2 hover:text-olive"
              onClick={() => setShowCoverPicker(v => !v)}
            >🖼 换封面</button>
            {showCoverPicker && (
              <CoverPicker
                recipe={recipe}
                onPatched={setRecipe}
                onClose={() => setShowCoverPicker(false)}
                onError={onError}
              />
            )}
          </div>
        </div>

        {/* 信息条：仅手机端 */}
        <div className="md:hidden bg-card rounded-card shadow-soft flex justify-between text-center px-2 py-3.5 mb-3.5">
          {statItems.map(([ic, lb, vl], i) => (
            <div key={lb} className={`flex-1 ${i > 0 ? 'border-l border-line' : ''}`}>
              <div className="text-[15px] mb-1">{ic}</div>
              <div className="text-[10.5px] text-muted mb-0.5">{lb}</div>
              <div className="text-[13.5px] font-bold text-ink">{vl}</div>
            </div>
          ))}
        </div>

        {/* 评价 */}
        <div className="a-rating bg-card rounded-card shadow-soft p-[18px] mb-3.5 md:mb-0">
          <div className="font-serif text-[17px] font-extrabold text-ink mb-3.5">我的评价</div>
          <div className="flex items-center gap-2.5 mb-2.5">
            <Stars value={recipe.rating} size="text-[26px]" onRate={v => patch({ rating: v }, true)} />
            <span className="text-xs text-muted">点星星评分</span>
          </div>
          <input
            className="w-full border-0 bg-bg rounded-[10px] px-3 py-2.5 text-[13px] text-ink2 outline-none"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            onBlur={() => { if (memo !== (recipe.rating_memo || '')) patch({ rating_memo: memo }, true); }}
            placeholder="做完后来记一句感受…"
          />
        </div>

        {/* 步骤 */}
        <div className="a-steps bg-card rounded-card shadow-soft p-[18px] mb-3.5 md:mb-0">
          <div className="font-serif text-[17px] font-extrabold text-ink mb-3.5 flex items-center gap-2">
            烹饪步骤
            <span className="text-[11px] text-muted font-normal font-sans">
              {(recipe.steps || []).length} 步{recipe.duration ? ` · 约 ${recipe.duration}` : ''}
            </span>
          </div>
          {(!recipe.steps || !recipe.steps.length) ? (
            <div className="text-[13px] text-muted py-2">暂无步骤，可在原文里补充后重新整理</div>
          ) : (
            <div className="steps-rail pl-1.5">
              {recipe.steps.map((s, i) => (
                <div key={i} className="relative flex gap-3.5 py-[11px]">
                  <div className="shrink-0 w-[26px] h-[26px] rounded-full bg-olive text-white text-[12.5px] font-bold flex items-center justify-center relative z-[1]">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-ink2 leading-[1.75]">{s.text}</div>
                    {(s.heat || s.time) && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {s.heat && <span className="text-[11px] text-olive bg-olive-soft rounded-md px-2 py-[3px]">🔥 {s.heat}</span>}
                        {s.time && <span className="text-[11px] text-olive bg-olive-soft rounded-md px-2 py-[3px]">⏱ {s.time}</span>}
                      </div>
                    )}
                    {s.tweak && editingStep !== i && (
                      <div className="mt-2 bg-tweak-bg border-l-[3px] border-tweak-bar rounded-r-[10px] px-3 py-2 text-[12.5px] text-[#8a6d1a] leading-relaxed">
                        <b className="text-[11px] text-[#B78A00]">我的调整：</b>{s.tweak}
                      </div>
                    )}
                    {editingStep === i ? (
                      <TweakEditor
                        initial={s.tweak}
                        onSave={text => saveStepTweak(i, text)}
                        onCancel={() => setEditingStep(-1)}
                      />
                    ) : (
                      <button
                        className="mt-2 text-[12px] text-muted hover:text-olive"
                        onClick={() => setEditingStep(i)}
                      >{s.tweak ? '✏️ 编辑调整' : '＋ 我的调整'}</button>
                    )}
                    {s.tweak && editingStep !== i && (
                      <button
                        className="mt-2 ml-3 text-[12px] text-muted hover:text-[#C0492F]"
                        onClick={() => saveStepTweak(i, '')}
                      >删除</button>
                    )}
                  </div>
                  {s.time && <div className="shrink-0 text-xs text-muted pt-[3px] whitespace-nowrap">{s.time}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 食材 */}
        <Accordion title="食材准备" count={(recipe.ingredients || []).length} className="a-ing mb-3.5 md:mb-0">
          <ListTable items={recipe.ingredients} />
        </Accordion>

        {/* 调料 */}
        <Accordion title="调味料" count={(recipe.seasonings || []).length} className="a-season mb-3.5 md:mb-0">
          <ListTable items={recipe.seasonings} />
        </Accordion>

        {/* 注意事项 */}
        <div className="a-notes bg-card rounded-card shadow-soft p-[18px] mb-3.5 md:mb-0">
          <div className="font-serif text-[17px] font-extrabold text-ink mb-3.5">注意事项</div>
          <textarea
            className="w-full border-0 bg-[#FBF7E9] rounded-xl px-3.5 py-3 text-[13.5px] leading-[1.8] text-ink2 outline-none min-h-[70px] resize-y"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => { if (notes !== (recipe.notes || '')) patch({ notes }, true); }}
            placeholder="记录做菜时的注意事项…"
          />
        </div>

        {/* 底部 */}
        <div className="a-foot bg-card rounded-card shadow-soft p-[18px] flex items-center justify-between gap-2.5 flex-wrap">
          {recipe.source_url ? (
            <a className="text-[12.5px] text-olive" href={recipe.source_url} target="_blank" rel="noreferrer">
              🔗 查看原始小红书笔记
            </a>
          ) : <span className="text-[12.5px] text-muted">手动录入</span>}
          <button className="text-[12.5px] text-[#C9C9BC] hover:text-[#C0492F]" onClick={del}>删除菜谱</button>
        </div>
      </div>
    </section>
  );
}
