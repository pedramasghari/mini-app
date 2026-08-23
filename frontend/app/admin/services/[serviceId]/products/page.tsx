"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Edit3, Film, Image as ImageIcon, Plus, Power, Save, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useParams } from "next/navigation";

type MediaType = "image" | "video" | null;
type Step = { title: string; content: string; mediaType: MediaType; mediaUrl: string | null; requiresInput: boolean; inputKey: string | null; inputLabel: string | null };
type Guide = { id: string; title: string; description: string | null; active: boolean; steps: Step[] } | null;
type Product = { id: string; serviceId: string; title: string; description: string; price: string; currency: string; icon: string; active: boolean; requiresGuide: boolean };
type Service = { id: string; title: string };

const input = "w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-400/50";
const blankStep = (): Step => ({ title: "", content: "", mediaType: null, mediaUrl: null, requiresInput: false, inputKey: null, inputLabel: null });

export default function ProductsPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [serviceTitle, setServiceTitle] = useState("محصولات سرویس");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", price: "", currency: "IRT", icon: "box", active: true, requiresGuide: true });
  const [guideTitle, setGuideTitle] = useState("");
  const [guideDescription, setGuideDescription] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);

  async function load() {
    setLoading(true); setError("");
    try {
      const [items, service] = await Promise.all([api<Product[]>(`admin/services/${serviceId}/products`), api<Service>(`admin/services/${serviceId}`)]);
      setProducts(items); setServiceTitle(service.title);
    } catch (e) { setError(e instanceof Error ? e.message : "خطا در دریافت اطلاعات"); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (serviceId) void load(); }, [serviceId]);

  function createProduct() { setEditing(null); setForm({ title: "", description: "", price: "", currency: "IRT", icon: "box", active: true, requiresGuide: true }); setProductOpen(true); }
  function editProduct(p: Product) { setEditing(p); setForm({ title: p.title, description: p.description, price: p.price, currency: p.currency, icon: p.icon, active: p.active, requiresGuide: p.requiresGuide }); setProductOpen(true); }
  async function saveProduct() {
    setSaving(true); setError("");
    try {
      const saved = editing ? await api<Product>(`admin/products/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }) : await api<Product>("admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, serviceId }) });
      setProducts(items => editing ? items.map(p => p.id === saved.id ? saved : p) : [...items, saved]); setProductOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "ذخیره محصول ناموفق بود."); }
    finally { setSaving(false); }
  }
  async function toggle(p: Product) { try { const saved = await api<Product>(`admin/products/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !p.active }) }); setProducts(items => items.map(x => x.id === saved.id ? saved : x)); } catch (e) { setError(e instanceof Error ? e.message : "خطا"); } }
  async function remove(p: Product) { if (!confirm(`محصول «${p.title}» غیرفعال شود؟`)) return; try { const saved = await api<Product>(`admin/products/${p.id}`, { method: "DELETE" }); setProducts(items => items.map(x => x.id === saved.id ? saved : x)); } catch (e) { setError(e instanceof Error ? e.message : "حذف ناموفق بود."); } }

  async function openGuide(p: Product) {
    setEditing(p); setGuideOpen(true); setError("");
    try { const guide = await api<Guide>(`admin/products/${p.id}/guide`); setGuideTitle(guide?.title ?? ""); setGuideDescription(guide?.description ?? ""); setSteps(guide?.steps ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : "خطا در دریافت راهنما"); }
  }
  function addStep() { setSteps(items => [...items, blankStep()]); }
  function updateStep(index: number, patch: Partial<Step>) { setSteps(items => items.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  function removeStep(index: number) { setSteps(items => items.filter((_, i) => i !== index)); }

  async function uploadMedia(index: number, file: File) {
    if (!editing) return;
    if (file.size > 30 * 1024 * 1024) { setError("حداکثر حجم فایل ۳۰ مگابایت است."); return; }
    const formData = new FormData(); formData.append("file", file);
    setError("");
    try {
      const uploaded = await api<{ url: string; mediaType: "image" | "video" }>("admin/guide-media/upload", { method: "POST", body: formData });
      updateStep(index, { mediaType: uploaded.mediaType, mediaUrl: uploaded.url });
    } catch (e) { setError(e instanceof Error ? e.message : "آپلود فایل ناموفق بود."); }
  }
  async function saveGuide() {
    if (!editing) return;
    if (!guideTitle.trim()) { setError("عنوان راهنما الزامی است."); return; }
    if (steps.some(step => !step.title.trim() || !step.content.trim())) { setError("عنوان و توضیحات تمام مراحل الزامی است."); return; }
    setSaving(true); setError("");
    try {
      await api(`admin/products/${editing.id}/guide`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: guideTitle.trim(), description: guideDescription.trim() || null, active: true, steps }) });
      setGuideOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "ذخیره راهنما ناموفق بود."); }
    finally { setSaving(false); }
  }
  async function deleteGuide() { if (!editing || !confirm("راهنمای این محصول غیرفعال شود؟")) return; try { await api(`admin/products/${editing.id}/guide`, { method: "DELETE" }); setGuideOpen(false); } catch (e) { setError(e instanceof Error ? e.message : "حذف راهنما ناموفق بود."); } }

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><Link href="/admin/services" className="mb-3 inline-flex items-center gap-2 text-xs text-white/40 hover:text-cyan-300"><ArrowRight size={15}/> بازگشت به سرویس‌ها</Link><h1 className="text-3xl font-black">{serviceTitle}</h1><p className="mt-2 text-sm text-white/40">مدیریت محصولات و Guide مرحله‌به‌مرحله هر محصول</p></div>
      <button onClick={createProduct} className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950"><Plus size={18}/> محصول جدید</button>
    </header>
    {error && <div className="rounded-2xl border border-red-400/10 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
    {loading ? <div className="p-20 text-center text-white/40">در حال بارگذاری...</div> : <div className="grid gap-4 xl:grid-cols-2">{products.map(p => <article key={p.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><div className="flex justify-between gap-3"><div className="flex gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">{p.icon || "◈"}</div><div><h2 className="font-bold">{p.title}</h2><div className="mt-1 text-xs text-white/35">{p.price} {p.currency}</div></div></div><span className={`rounded-full px-3 py-1 text-[11px] ${p.active ? "bg-emerald-400/10 text-emerald-300" : "bg-white/10 text-white/40"}`}>{p.active ? "فعال" : "غیرفعال"}</span></div><p className="mt-4 text-sm leading-6 text-white/45">{p.description}</p><div className="mt-4"><span className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/45">{p.requiresGuide ? "Guide فعال" : "بدون Guide"}</span></div><div className="mt-5 grid grid-cols-[1fr_auto_auto_auto] gap-2 border-t border-white/5 pt-4"><button onClick={() => void openGuide(p)} className="rounded-2xl bg-cyan-400/10 py-3 text-xs font-bold text-cyan-300">مدیریت Guide</button><button onClick={() => editProduct(p)} className="rounded-2xl border border-white/10 px-3"><Edit3 size={16}/></button><button onClick={() => void toggle(p)} className="rounded-2xl border border-white/10 px-3"><Power size={16}/></button><button onClick={() => void remove(p)} className="rounded-2xl border border-red-400/10 px-3 text-red-300"><Trash2 size={16}/></button></div></article>)}</div>}

    {productOpen && <Modal title={editing ? "ویرایش محصول" : "محصول جدید"} close={() => setProductOpen(false)}><div className="grid gap-4 md:grid-cols-2"><Field label="عنوان"><input className={input} value={form.title} onChange={e => setForm({...form,title:e.target.value})}/></Field><Field label="قیمت"><input className={input} value={form.price} onChange={e => setForm({...form,price:e.target.value})} dir="ltr"/></Field><Field label="توضیحات" full><textarea className={`${input} min-h-28`} value={form.description} onChange={e => setForm({...form,description:e.target.value})}/></Field><Field label="واحد پول"><input className={input} value={form.currency} onChange={e => setForm({...form,currency:e.target.value})}/></Field><Field label="Icon"><input className={input} value={form.icon} onChange={e => setForm({...form,icon:e.target.value})}/></Field><label className="flex items-center gap-2 rounded-2xl border border-white/10 p-4"><input type="checkbox" checked={form.active} onChange={e => setForm({...form,active:e.target.checked})}/> فعال</label><label className="flex items-center gap-2 rounded-2xl border border-white/10 p-4"><input type="checkbox" checked={form.requiresGuide} onChange={e => setForm({...form,requiresGuide:e.target.checked})}/> دارای Guide</label></div><button disabled={saving} onClick={() => void saveProduct()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-3 font-black text-slate-950"><Save size={17}/>{saving ? "در حال ذخیره..." : "ذخیره محصول"}</button></Modal>}

    {guideOpen && <Modal title={`Guide — ${editing?.title ?? ""}`} close={() => setGuideOpen(false)} wide><div className="space-y-5"><div className="rounded-3xl border border-cyan-400/10 bg-cyan-400/[0.03] p-4"><div className="text-xs text-cyan-300">Media به صورت Upload</div><p className="mt-1 text-xs leading-6 text-white/35">فایل در Backend/uploads/guides ذخیره می‌شود و URL آن در Step ذخیره خواهد شد. هر مرحله حداکثر یک تصویر یا ویدیو دارد.</p></div><Field label="عنوان راهنما"><input className={input} value={guideTitle} onChange={e => setGuideTitle(e.target.value)}/></Field><Field label="توضیحات راهنما"><textarea className={`${input} min-h-24`} value={guideDescription} onChange={e => setGuideDescription(e.target.value)}/></Field><div className="flex items-center justify-between"><div><h3 className="font-bold">مراحل</h3><p className="text-xs text-white/35">توضیح + یک Media اختیاری برای هر مرحله</p></div><button onClick={addStep} className="flex items-center gap-2 rounded-xl bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-300"><Plus size={15}/> مرحله جدید</button></div>{steps.map((step,index) => <div key={index} className="rounded-3xl border border-white/10 bg-white/[0.025] p-4"><div className="mb-4 flex items-center justify-between"><span className="text-sm font-bold">مرحله {index+1}</span><button onClick={() => removeStep(index)} className="rounded-xl p-2 text-red-300/70 hover:bg-red-400/10"><Trash2 size={16}/></button></div><div className="grid gap-4 md:grid-cols-2"><Field label="عنوان مرحله"><input className={input} value={step.title} onChange={e => updateStep(index,{title:e.target.value})}/></Field><div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><div className="mb-2 text-xs font-bold text-white/60">Media</div><div className="flex items-center gap-2">{step.mediaType === "image" ? <ImageIcon size={16} className="text-cyan-300"/> : step.mediaType === "video" ? <Film size={16} className="text-cyan-300"/> : <span className="text-xs text-white/30">فایلی انتخاب نشده</span>}<label className="cursor-pointer rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10"><input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={e => { const file=e.target.files?.[0]; if(file) void uploadMedia(index,file); e.currentTarget.value=""; }}/>{step.mediaUrl ? "تغییر فایل" : "انتخاب و آپلود"}</label>{step.mediaUrl && <button type="button" onClick={() => updateStep(index,{mediaType:null,mediaUrl:null})} className="rounded-xl p-2 text-red-300/70"><X size={15}/></button>}</div>{step.mediaUrl && <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/20">{step.mediaType === "image" ? <img src={step.mediaUrl} alt={step.title} className="max-h-48 w-full object-contain"/> : <video src={step.mediaUrl} controls className="max-h-48 w-full"/>}</div>}</div><Field label="توضیحات" full><textarea className={`${input} min-h-28`} value={step.content} onChange={e => updateStep(index,{content:e.target.value})}/></Field></div></div>)}{steps.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-xs text-white/30">هنوز مرحله‌ای اضافه نشده است.</div>}<div className="flex gap-2 border-t border-white/10 pt-5"><button onClick={() => void deleteGuide()} className="rounded-2xl border border-red-400/10 px-4 py-3 text-sm text-red-300">حذف Guide</button><button disabled={saving} onClick={() => void saveGuide()} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-3 font-black text-slate-950"><Save size={17}/>{saving ? "در حال ذخیره..." : "ذخیره Guide"}</button></div></div></Modal>}
  </div>;
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) { return <label className={full ? "md:col-span-2" : ""}><span className="mb-2 block text-xs font-bold text-white/60">{label}</span>{children}</label>; }
function Modal({ title, close, wide, children }: { title: string; close: () => void; wide?: boolean; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm md:items-center md:p-6"><div className={`max-h-[94dvh] w-full overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#0b1220] shadow-2xl md:rounded-[2rem] ${wide ? "max-w-5xl" : "max-w-2xl"}`}><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><h2 className="font-black">{title}</h2><button onClick={close} className="rounded-xl p-2 text-white/40 hover:bg-white/10"><X/></button></div><div className="max-h-[78dvh] overflow-y-auto p-5 md:p-7">{children}</div></div></div>; }
