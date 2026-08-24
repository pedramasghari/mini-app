'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { SupportAttachment, SupportMessage, SupportMeResponse } from './types';

const fmt = (value: string) => new Date(value).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

export function SupportChat() {
  const [messages, setMessages] = useState<SupportMessage[]>([]); const [text, setText] = useState(''); const [reply, setReply] = useState<SupportMessage | null>(null); const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null); const fileInput = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { const data = await api<SupportMeResponse>('support-chat/me'); setMessages(data.messages); }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  useEffect(() => { const stream = new EventSource('/api/notifications/stream'); stream.onmessage = (event) => { try { const p = JSON.parse(event.data); if (p.type === 'notification' && p.notification?.type === 'SUPPORT_MESSAGE') void load(); } catch {} }; return () => stream.close(); }, [load]);

  async function upload(file: File): Promise<SupportAttachment> { const form = new FormData(); form.append('file', file); return api<SupportAttachment>('support-chat/upload', { method: 'POST', body: form }); }
  async function send(attachments: SupportAttachment[] = []) {
    if ((!text.trim() && !attachments.length) || busy) return; setBusy(true);
    try { const message = await api<SupportMessage>('support-chat/me/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text, replyToMessageId: reply?.id ?? null, attachments }) }); setMessages((items) => [...items, message]); setText(''); setReply(null); } finally { setBusy(false); }
  }
  async function chooseFile(file: File) { setBusy(true); try { const attachment = await upload(file); const message = await api<SupportMessage>('support-chat/me/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: '', replyToMessageId: reply?.id ?? null, attachments: [attachment] }) }); setMessages((items) => [...items, message]); setReply(null); } finally { setBusy(false); } }

  return <section className="flex h-[70vh] min-h-[520px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#10151b] text-white shadow-2xl">
    <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4"><div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500/15 text-xl">🎧</div><div><h1 className="font-bold">پشتیبانی</h1><p className="text-xs text-white/50">پاسخ‌گویی آنلاین</p></div></header>
    <div className="flex-1 space-y-3 overflow-y-auto p-4">{!messages.length && <div className="grid h-full place-items-center text-center text-white/40"><div><div className="mb-2 text-4xl">💬</div><p>پیام خود را برای پشتیبانی ارسال کنید.</p></div></div>}{messages.map((message) => <div key={message.id} className={`flex ${message.senderRole === 'USER' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 ${message.senderRole === 'USER' ? 'rounded-br-md bg-emerald-600' : 'rounded-bl-md bg-white/8'}`}>{message.replyToMessageId && <div className="mb-2 border-r-2 border-white/30 pr-2 text-xs text-white/60">↩ پاسخ به پیام</div>}{message.attachments?.map((file) => file.type === 'IMAGE' ? <img key={file.url} src={file.url} alt="پیوست" className="mb-2 max-h-64 rounded-xl" /> : <video key={file.url} src={file.url} controls className="mb-2 max-h-64 rounded-xl" />)}{message.body && <p className="whitespace-pre-wrap text-sm leading-7">{message.body}</p>}<div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/50">{fmt(message.createdAt)} {message.senderRole === 'USER' && <span>{message.status === 'READ' ? '✓✓' : '✓'}</span>}</div><button onClick={() => setReply(message)} className="mt-1 text-[11px] text-white/50 hover:text-white">↩ پاسخ</button></div></div>)}<div ref={bottom} /></div>
    <div className="border-t border-white/10 p-3">{reply && <div className="mb-2 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs"><span>پاسخ به: {reply.body || 'رسانه'}</span><button onClick={() => setReply(null)}>✕</button></div>}<div className="flex items-end gap-2"><input ref={fileInput} hidden type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={(e) => { const file = e.target.files?.[0]; if (file) void chooseFile(file); e.currentTarget.value = ''; }} /><button type="button" title="ارسال تصویر یا ویدیو" onClick={() => fileInput.current?.click()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-lg">📎</button><textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="پیام خود را بنویسید..." rows={1} className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-emerald-500" /><button disabled={busy || !text.trim()} onClick={() => void send()} className="h-11 rounded-xl bg-emerald-500 px-5 font-bold text-black disabled:opacity-40">ارسال</button></div></div>
  </section>;
}
