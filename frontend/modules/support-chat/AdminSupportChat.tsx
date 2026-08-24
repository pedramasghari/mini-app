'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { SupportAdminConversation, SupportMessage } from './types';

const time = (v?: string | null) => v ? new Date(v).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '';

export function AdminSupportChat() {
  const [items, setItems] = useState<SupportAdminConversation[]>([]);
  const [selected, setSelected] = useState<SupportAdminConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');

  async function loadList() { setItems(await api<SupportAdminConversation[]>('support-chat/admin/conversations')); }
  async function openConversation(item: SupportAdminConversation) { setSelected(item); const data = await api<{ messages: SupportMessage[] }>(`support-chat/admin/conversations/${item.id}`); setMessages(data.messages); await loadList(); }
  useEffect(() => { void loadList(); const stream = new EventSource('/api/notifications/stream'); stream.onmessage = () => { void loadList(); if (selected) void openConversation(selected); }; return () => stream.close(); }, [selected?.id]);
  async function send() { if (!selected || !text.trim()) return; const message = await api<SupportMessage>(`support-chat/admin/conversations/${selected.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) }); setMessages((v) => [...v, message]); setText(''); }

  return <main dir="rtl" className="flex min-h-[80vh] overflow-hidden rounded-3xl border border-white/10 bg-[#0d1218] text-white">
    <aside className="w-[330px] shrink-0 border-l border-white/10 bg-[#111820]">
      <div className="border-b border-white/10 p-5"><h1 className="text-lg font-bold">پشتیبانی</h1><p className="mt-1 text-xs text-white/40">گفتگوهای کاربران</p></div>
      <div className="max-h-[75vh] overflow-y-auto">
        {items.map((item) => <button key={item.id} onClick={() => void openConversation(item)} className={`flex w-full gap-3 border-b border-white/5 p-4 text-right hover:bg-white/5 ${selected?.id === item.id ? 'bg-emerald-500/10' : ''}`}>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-500/15 font-bold">{(item.user?.firstName || item.user?.username || '؟').slice(0, 1)}</div>
          <div className="min-w-0 flex-1"><div className="flex items-center justify-between"><strong className="truncate text-sm">{[item.user?.firstName, item.user?.lastName].filter(Boolean).join(' ') || item.user?.username || 'کاربر'}</strong><span className="text-[10px] text-white/30">{time(item.lastMessageAt)}</span></div><p className="mt-1 truncate text-xs text-white/45">{item.lastMessagePreview || 'گفتگوی جدید'}</p>{item.userUnreadCount > 0 && <span className="mt-2 inline-flex min-w-5 justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-black">{item.userUnreadCount}</span>}</div>
        </button>)}
        {!items.length && <div className="p-8 text-center text-sm text-white/35">هنوز گفتگویی وجود ندارد.</div>}
      </div>
    </aside>
    <section className="flex min-w-0 flex-1 flex-col">
      {!selected ? <div className="grid flex-1 place-items-center text-white/30">یک گفتگو را انتخاب کنید.</div> : <>
        <header className="border-b border-white/10 p-4"><strong>{[selected.user?.firstName, selected.user?.lastName].filter(Boolean).join(' ') || selected.user?.username || 'کاربر'}</strong><div className="text-xs text-white/35">{selected.user?.username ? `@${selected.user.username}` : ''}</div></header>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">{messages.map((m) => <div key={m.id} className={`flex ${m.senderRole === 'ADMIN' ? 'justify-start' : 'justify-end'}`}><div className={`max-w-[75%] rounded-2xl px-4 py-3 ${m.senderRole === 'ADMIN' ? 'bg-emerald-600 text-black' : 'bg-white/8'}`}><p className="whitespace-pre-wrap text-sm leading-7">{m.body}</p><div className="mt-1 text-[10px] opacity-50">{time(m.createdAt)} {m.senderRole === 'ADMIN' && '✓✓'}</div></div></div>)}</div>
        <div className="flex gap-2 border-t border-white/10 p-3"><textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="پاسخ به کاربر..." className="min-h-12 flex-1 resize-none rounded-xl bg-white/5 px-4 py-3 text-sm outline-none"/><button onClick={() => void send()} className="rounded-xl bg-emerald-500 px-5 font-bold text-black">ارسال</button></div>
      </>}
    </section>
  </main>;
}
