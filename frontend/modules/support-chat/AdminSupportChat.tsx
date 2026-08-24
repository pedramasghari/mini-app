'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCheck, Paperclip, Send, UserRound, X } from 'lucide-react';
import { api } from '../../lib/api';
import type { SupportAdminConversation, SupportAttachment, SupportMessage } from './types';

const time = (v?: string | null) => v ? new Date(v).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '';

export function AdminSupportChat() {
  const [items, setItems] = useState<SupportAdminConversation[]>([]);
  const [selected, setSelected] = useState<SupportAdminConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<SupportMessage | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  async function loadList() {
    const data = await api<SupportAdminConversation[]>('support-chat/admin/conversations');
    setItems(data);
    setSelected((current) => current ? data.find((item) => item.id === current.id) ?? current : current);
  }

  async function openConversation(item: SupportAdminConversation) {
    setSelected(item);
    setLoadingConversation(true);
    try {
      const data = await api<{ messages: SupportMessage[] }>(`support-chat/admin/conversations/${item.id}`);
      setMessages(data.messages);
      await loadList();
    } finally {
      setLoadingConversation(false);
    }
  }

  useEffect(() => {
    void loadList();

    // The backend already exposes an authenticated SSE stream. Support messages
    // are emitted through the same realtime channel, so no polling is required.
    const stream = new EventSource('/api/notifications/stream');
    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          notification?: { type?: string; data?: { conversationId?: string; messageId?: string } };
        };
        if (payload.notification?.type !== 'SUPPORT_MESSAGE') return;
        const conversationId = payload.notification.data?.conversationId;
        if (!conversationId) return;

        void loadList();
        if (selected?.id !== conversationId) return;

        void api<{ messages: SupportMessage[] }>(`support-chat/admin/conversations/${conversationId}`).then((data) => {
          setMessages((current) => {
            const known = new Set(current.map((message) => message.id));
            return [...current, ...data.messages.filter((message) => !known.has(message.id))];
          });
        });
      } catch {
        // Ignore malformed heartbeat/stream events.
      }
    };

    return () => stream.close();
  }, [selected?.id]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function send(attachments: SupportAttachment[] = []) {
    if (!selected || (!text.trim() && !attachments.length) || sending) return;
    setSending(true);
    try {
      const message = await api<SupportMessage>(`support-chat/admin/conversations/${selected.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, replyToMessageId: reply?.id ?? null, attachments }),
      });
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setText('');
      setReply(null);
      await loadList();
    } finally {
      setSending(false);
    }
  }

  async function upload(file: File) {
    if (!selected) return;
    const form = new FormData();
    form.append('file', file);
    const attachment = await api<SupportAttachment>('support-chat/upload', { method: 'POST', body: form });
    await send([attachment]);
  }

  const userName = selected ? ([selected.user?.firstName, selected.user?.lastName].filter(Boolean).join(' ') || selected.user?.username || 'کاربر') : '';

  return (
    <main dir="rtl" className="flex min-h-[calc(100dvh-180px)] overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1119] text-white shadow-2xl shadow-black/20">
      <aside className={`w-full shrink-0 border-l border-white/10 bg-[#0f1721] md:block md:w-[340px] ${selected ? 'hidden' : 'block'}`}>
        <div className="border-b border-white/10 bg-[#101923]/90 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black">گفتگوهای پشتیبانی</h2>
              <p className="mt-1 text-xs text-white/35">پیام‌ها به صورت لحظه‌ای دریافت می‌شوند</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><HeadsetIcon /></span>
          </div>
        </div>
        <div className="max-h-[calc(100dvh-270px)] overflow-y-auto">
          {items.map((item) => {
            const name = [item.user?.firstName, item.user?.lastName].filter(Boolean).join(' ') || item.user?.username || 'کاربر';
            return (
              <button key={item.id} onClick={() => void openConversation(item)} className={`flex w-full gap-3 border-b border-white/5 p-4 text-right transition hover:bg-white/5 ${selected?.id === item.id ? 'bg-emerald-400/10' : ''}`}>
                <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-400/10 font-bold text-emerald-200">
                  {item.user?.photoUrl ? <img src={item.user.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserRound size={19} />}
                  {item.userUnreadCount > 0 && <span className="absolute -left-0.5 -top-0.5 min-w-5 rounded-full bg-emerald-400 px-1 py-0.5 text-center text-[9px] font-black text-black">{item.userUnreadCount}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{name}</strong><span className="shrink-0 text-[10px] text-white/25">{time(item.lastMessageAt)}</span></div>
                  <p className="mt-1 truncate text-xs text-white/40">{item.lastMessagePreview || 'گفتگوی جدید'}</p>
                </div>
              </button>
            );
          })}
          {!items.length && <div className="p-10 text-center text-sm text-white/30">هنوز گفتگویی وجود ندارد.</div>}
        </div>
      </aside>

      <section className={`min-w-0 flex-1 flex-col ${selected ? 'flex' : 'hidden md:flex'}`}>
        {!selected ? (
          <div className="grid flex-1 place-items-center text-center text-white/25"><div><HeadsetIcon large /><p className="mt-3 text-sm">یک گفتگو را انتخاب کنید.</p></div></div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-white/10 bg-[#101923]/90 p-4 backdrop-blur-xl">
              <button type="button" onClick={() => { setSelected(null); setMessages([]); setReply(null); }} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-white/60 transition hover:bg-white/5 hover:text-white md:hidden" aria-label="بازگشت به گفتگوها"><ArrowRight size={18} /></button>
              <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-400/10 text-emerald-200">
                {selected.user?.photoUrl ? <img src={selected.user.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserRound size={19} />}
              </div>
              <div className="min-w-0 flex-1"><strong className="block truncate">{userName}</strong><span className="text-xs text-white/30">{selected.user?.username ? `@${selected.user.username}` : 'گفتگوی پشتیبانی'}</span></div>
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-300 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Realtime</span>
            </header>

            <div ref={messagesRef} className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(34,211,238,.04),transparent_35%)] p-4 sm:p-6">
              {loadingConversation ? <div className="grid h-full place-items-center text-sm text-white/30">در حال بارگذاری گفتگو...</div> : messages.map((m) => (
                <div key={m.id} className={`flex ${m.senderRole === 'ADMIN' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`group max-w-[88%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[72%] ${m.senderRole === 'ADMIN' ? 'rounded-bl-md bg-emerald-400 text-[#06100c]' : 'rounded-br-md border border-white/8 bg-white/[0.06]'}`}>
                    {m.replyToMessageId && <div className="mb-2 rounded-lg bg-black/10 px-2 py-1 text-[10px] opacity-60">↩ پاسخ به پیام</div>}
                    {m.attachments?.map((f) => f.type === 'IMAGE' ? <img key={f.url} src={f.url} alt="پیوست" className="mb-2 max-h-72 rounded-xl object-contain" /> : <video key={f.url} src={f.url} controls className="mb-2 max-h-72 w-full rounded-xl" />)}
                    {m.body && <p className="whitespace-pre-wrap text-sm leading-7">{m.body}</p>}
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-45"><span>{time(m.createdAt)}</span>{m.senderRole === 'ADMIN' && <CheckCheck size={12} />}</div>
                    <button onClick={() => setReply(m)} className="mt-1 text-[10px] opacity-40 transition hover:opacity-80">↩ پاسخ</button>
                  </div>
                </div>
              ))}
            </div>

            {reply && <div className="flex items-center gap-2 border-t border-white/5 bg-white/[0.025] px-4 py-2 text-xs text-white/45"><span className="min-w-0 flex-1 truncate">در حال پاسخ به: {reply.body || 'پیوست'}</span><button onClick={() => setReply(null)} aria-label="لغو پاسخ"><X size={15} /></button></div>}
            <div className="border-t border-white/10 bg-[#101923] p-3 sm:p-4">
              <div className="flex items-end gap-2 rounded-2xl border border-white/8 bg-white/[0.035] p-2">
                <input ref={fileInput} hidden type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.currentTarget.value = ''; }} />
                <button type="button" onClick={() => fileInput.current?.click()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white/45 transition hover:bg-white/5 hover:text-white" aria-label="پیوست"><Paperclip size={19} /></button>
                <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder={reply ? 'پاسخ به پیام...' : 'پیام خود را بنویسید...'} className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 outline-none placeholder:text-white/25" />
                <button type="button" disabled={sending} onClick={() => void send()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400 text-[#041009] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40" aria-label="ارسال"><Send size={18} /></button>
              </div>
              <div className="mt-2 px-1 text-[10px] text-white/20">Enter برای ارسال · Shift + Enter برای خط جدید</div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function HeadsetIcon({ large = false }: { large?: boolean }) {
  return <span className={`grid place-items-center rounded-xl bg-emerald-400/10 text-emerald-300 ${large ? 'mx-auto h-14 w-14' : 'h-10 w-10'}`}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={large ? 'h-7 w-7' : 'h-5 w-5'}>
      <path d="M4 13a8 8 0 0 1 16 0" /><path d="M4 13v3a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2Z" /><path d="M20 13v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z" /><path d="M15 18c-.8 1-2 1.5-3.5 1.5" />
    </svg>
  </span>;
}
