import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Add({ onParsed, onError }) {
  const [tab, setTab] = useState('link');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');

  // 自动读取剪贴板提示粘贴
  useEffect(() => {
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(t => {
        if (t && /https?:\/\/(xhslink|www\.xiaohongshu)/.test(t) && !url) setUrl(t.trim());
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (busy) return;
    const body = tab === 'link' ? { url } : { title, text };
    if (tab === 'link' && !url.trim()) return onError('请先粘贴小红书链接');
    if (tab === 'text' && !text.trim()) return onError('请先粘贴笔记文字');
    setBusy(true);
    setPhase(tab === 'link' ? '正在读取小红书笔记…' : '正在整理菜谱…');
    const timer = setTimeout(() => setPhase('AI 正在整理食材 / 步骤 / 火候…'), 4000);
    try {
      const preview = await api.parse(body);
      onParsed(preview);
    } catch (e) {
      onError(`${e.message}，可改用「粘贴文字」`);
    } finally {
      clearTimeout(timer);
      setBusy(false);
      setPhase('');
    }
  };

  return (
    <section>
      <div className="flex items-baseline justify-between px-0.5 pt-5 pb-3.5">
        <h2 className="font-serif text-2xl font-extrabold text-ink">添加菜谱</h2>
      </div>
      <div className="md:max-w-[640px] md:mx-auto">
        <div className="bg-card rounded-card shadow-soft p-5">
          <div className="flex bg-bg rounded-xl p-1 mb-4">
            <button
              className={`flex-1 py-2.5 rounded-lg text-sm ${tab === 'link' ? 'bg-card text-olive font-bold shadow-soft' : 'text-ink2'}`}
              onClick={() => setTab('link')}
            >🔗 粘贴链接</button>
            <button
              className={`flex-1 py-2.5 rounded-lg text-sm ${tab === 'text' ? 'bg-card text-olive font-bold shadow-soft' : 'text-ink2'}`}
              onClick={() => setTab('text')}
            >📝 粘贴文字</button>
          </div>

          {tab === 'link' ? (
            <div>
              <input
                className="w-full border-[1.5px] border-line rounded-xl px-3.5 py-3 text-sm outline-none bg-white text-ink focus:border-olive"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="粘贴小红书做饭笔记链接"
              />
              <p className="text-xs text-muted leading-relaxed mt-2.5 mb-4 px-0.5">
                在小红书笔记右上角点「分享 → 复制链接」，回到这里粘贴。封面会自动保存到本地素材库。
              </p>
            </div>
          ) : (
            <div>
              <input
                className="w-full border-[1.5px] border-line rounded-xl px-3.5 py-3 text-sm outline-none bg-white text-ink focus:border-olive"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="菜名，如：可乐鸡翅"
              />
              <textarea
                className="w-full border-[1.5px] border-line rounded-xl px-3.5 py-3 text-sm outline-none bg-white text-ink focus:border-olive min-h-[120px] resize-y leading-relaxed mt-2.5"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="把笔记里的做法文字粘贴到这里：食材、调料、步骤……"
              />
              <p className="text-xs text-muted leading-relaxed mt-2.5 mb-4 px-0.5">
                适合纯视频笔记：在笔记文案里长按复制文字，粘贴过来即可整理。
              </p>
            </div>
          )}

          <button
            className="w-full bg-olive text-white text-[15px] font-semibold py-3.5 rounded-full shadow-[0_6px_16px_rgba(95,112,80,.28)] disabled:opacity-50"
            onClick={submit}
            disabled={busy}
          >{busy ? '生成中…' : '生成菜谱卡'}</button>

          {busy && (
            <div className="flex items-center gap-2.5 mt-3.5 text-[13px] text-ink2">
              <span className="spinner"></span>
              <span>{phase}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
