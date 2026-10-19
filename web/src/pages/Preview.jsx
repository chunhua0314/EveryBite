import React, { useState } from 'react';
import { api } from '../api.js';
import { TagEditor, Cover } from '../components.jsx';

export default function Preview({ preview, setPreview, referenceText, onSaved, onBack, onError, toast }) {
  const [busy, setBusy] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const p = preview;
  const patch = (obj) => setPreview({ ...p, ...obj });

  const save = async () => {
    if (busy || p.insufficient) return;
    if (!p.title.trim()) return onError('菜名不能为空');
    setBusy(true);
    try {
      const { via, insufficient, reason, ...body } = p;
      const saved = await api.createRecipe(body);
      toast('已保存到菜谱库 🎉');
      onSaved(saved);
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reparse = async () => {
    if (reparsing) return;
    setReparsing(true);
    try {
      const body = p.source_url ? { url: p.source_url } : { title: p.title, text: p.raw_text };
      if (referenceText && referenceText.trim()) body.referenceText = referenceText;
      const fresh = await api.parse(body);
      setPreview({ ...fresh, title: p.title, tags: p.tags });
      toast('已重新整理');
    } catch (e) {
      onError(e.message);
    } finally {
      setReparsing(false);
    }
  };

  const statLine = [
    p.duration && `⏱ ${p.duration}`,
    p.difficulty && `📶 ${p.difficulty}`,
    p.taste && `🌶 ${p.taste}`,
    p.main_ingredient && `🍗 ${p.main_ingredient}`,
  ].filter(Boolean).join(' · ');

  const viaBadge = p.insufficient
    ? { text: '⚠️ 信息不足', cls: 'bg-tweak-bg text-[#8a6d1a]' }
    : p.via === 'rule'
      ? { text: '规则整理', cls: 'bg-bg text-muted' }
      : { text: 'AI 整理', cls: 'bg-olive-soft text-olive' };

  return (
    <section>
      <div className="flex items-center justify-between px-0.5 pt-5 pb-3.5">
        <button className="bg-card rounded-full px-3.5 py-2 text-[13px] text-ink2 shadow-soft" onClick={onBack}>‹ 返回</button>
        <span className={`text-xs rounded-full px-2.5 py-1 ${viaBadge.cls}`}>{viaBadge.text}</span>
      </div>

      <div className="md:max-w-[640px] md:mx-auto">
        {p.insufficient && (
          <div className="mb-3.5 bg-tweak-bg border-l-[3px] border-tweak-bar rounded-r-xl p-3.5">
            <div className="text-[13px] text-[#8a6d1a] leading-relaxed font-semibold mb-1">
              ⚠️ 笔记正文信息不足，AI 没有编造做法。
            </div>
            {p.reason && <div className="text-[12px] text-[#8a6d1a]/80 mb-2">{p.reason}</div>}
            <div className="text-[12px] text-[#8a6d1a]/80 leading-relaxed">
              请返回上一页，把小红书「AI 点点」总结的步骤文字粘贴到「参考文字」后重新整理。
            </div>
          </div>
        )}
        <div className="bg-card rounded-card shadow-soft p-6 mb-3.5 relative overflow-hidden">
          <div className="font-serif text-[44px] font-extrabold text-olive-line leading-none">★</div>
          <input
            value={p.title}
            onChange={e => patch({ title: e.target.value })}
            className="font-serif text-[30px] font-extrabold text-ink mt-1 mb-0.5 w-full bg-transparent outline-none border-b border-transparent focus:border-olive-line"
          />
          <div className="text-[11px] text-muted tracking-[2.5px] mb-3">{p.subtitle || ''}</div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[12px] text-muted shrink-0">主分类</span>
            <input
              value={p.category || ''}
              onChange={e => patch({ category: e.target.value })}
              list="common-categories"
              placeholder="如 川菜 / 家常菜"
              className="text-xs border border-olive-line rounded-full px-3 py-1.5 outline-none w-32 bg-white text-olive font-semibold focus:border-olive"
            />
            <datalist id="common-categories">
              {['川菜', '粤菜', '湘菜', '东北菜', '江浙菜', '家常菜', '汤羹', '主食', '面点', '甜品', '饮品', '轻食', '其他'].map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          {p.summary && <p className="text-[13px] text-ink2 leading-[1.9] mb-3.5">{p.summary}</p>}
          <TagEditor tags={p.tags || []} onChange={tags => patch({ tags })} />
          {statLine && <div className="text-[12.5px] text-ink2 mt-3.5">{statLine}</div>}
          <div className="relative mt-3.5">
            <Cover recipe={p} className="aspect-video" emojiSize="text-[56px]" rounded="rounded-[14px]" />
            {p.cover_local && (
              <span className="absolute bottom-2 right-3 text-[10px] text-white bg-ink/50 rounded-full px-2 py-0.5">封面已存本地</span>
            )}
          </div>
        </div>

        <div className="bg-card rounded-card shadow-soft p-5 mb-3.5">
          <div className="font-serif text-[17px] font-extrabold text-ink mb-3.5 flex items-center gap-2">
            整理结果 <span className="text-[11px] text-muted font-normal font-sans">保存后可随时调整</span>
          </div>
          <table className="w-full border-collapse text-[13.5px]">
            <tbody>
              <tr className="border-b border-[#F2F0E8]">
                <td className="py-2 text-ink2">食材</td>
                <td className="py-2 text-right text-ink font-semibold">{(p.ingredients || []).length} 项</td>
              </tr>
              <tr className="border-b border-[#F2F0E8]">
                <td className="py-2 text-ink2">调料</td>
                <td className="py-2 text-right text-ink font-semibold">{(p.seasonings || []).length} 项</td>
              </tr>
              <tr>
                <td className="py-2 text-ink2">步骤</td>
                <td className="py-2 text-right text-ink font-semibold">
                  {(p.steps || []).length} 步{p.duration ? ` · 约 ${p.duration}` : ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex gap-2.5">
          <button
            className="flex-1 bg-card text-ink2 text-[15px] font-semibold py-3.5 rounded-full shadow-soft disabled:opacity-50"
            onClick={reparse}
            disabled={reparsing}
          >{reparsing ? '整理中…' : '↻ 重新整理'}</button>
          <button
            className="flex-[2] bg-olive text-white text-[15px] font-semibold py-3.5 rounded-full shadow-[0_6px_16px_rgba(95,112,80,.28)] disabled:opacity-50"
            onClick={save}
            disabled={busy || p.insufficient}
            title={p.insufficient ? '信息不足，无法保存' : ''}
          >{p.insufficient ? '信息不足，无法保存' : busy ? '保存中…' : '保存到菜谱库'}</button>
        </div>
      </div>
    </section>
  );
}
