import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { BarChart3, FilePenLine, LogOut, RefreshCw, Users, Eye, Download, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { FormBuilder } from './FormBuilder';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

type MetricRow = { name: string; count: number };
type Metrics = {
  days: number;
  totals: { visitors: number; page_views: number; form_starts: number; form_completions: number; downloads: number; conversion_rate: number };
  sources: MetricRow[]; pages: MetricRow[]; forms: MetricRow[]; searches: MetricRow[]; clicks: MetricRow[];
  daily: { date: string; page_views: number; visitors: number }[];
};

function Ranking({ title, rows }: { title: string; rows: MetricRow[] }) {
  const maximum = Math.max(1, ...rows.map((row) => row.count));
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 font-semibold text-slate-800">{title}</h3><div className="space-y-3">{rows.length ? rows.map((row) => <div key={row.name}><div className="mb-1 flex justify-between gap-4 text-sm"><span className="truncate text-slate-600">{row.name}</span><strong>{row.count}</strong></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${row.count / maximum * 100}%` }} /></div></div>) : <p className="text-sm text-slate-400">No data yet</p>}</div></section>;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'metrics' | 'builder'>(() => window.location.search.includes('builder') ? 'builder' : 'metrics');
  const [days, setDays] = useState(30);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  useDocumentMeta({ title: 'Admin Dashboard | Oky-Docky', canonical: '/admin', robots: 'noindex,nofollow' });

  const load = async () => {
    setLoading(true);
    const response = await fetch(`/api/admin/analytics?days=${days}`);
    if (response.status === 401 || response.status === 503) { navigate('/admin/login', { replace: true }); return; }
    if (response.ok) { setMetrics(await response.json()); setAuthorized(true); }
    setLoading(false);
  };
  useEffect(() => { load().catch(() => setLoading(false)); }, [days]);

  const logout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); navigate('/admin/login', { replace: true }); };
  if (!authorized) return <div className="min-h-screen flex items-center justify-center text-slate-500">Checking admin session...</div>;
  if (tab === 'builder') return <div><AdminNav tab={tab} setTab={setTab} logout={logout} /><FormBuilder onBack={() => setTab('metrics')} /></div>;

  const cards = metrics ? [
    ['Visitors', metrics.totals.visitors, Users], ['Page views', metrics.totals.page_views, Eye],
    ['Downloads', metrics.totals.downloads, Download], ['Conversion', `${metrics.totals.conversion_rate}%`, TrendingUp],
  ] as const : [];
  return <div className="min-h-screen"><AdminNav tab={tab} setTab={setTab} logout={logout} /><main className="container mx-auto max-w-7xl px-4 py-8"><div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold text-slate-900">Site metrics</h1><p className="text-slate-500">First-party analytics without form answers or IP storage</p></div><div className="flex gap-2">{[7,30,90].map((value)=><Button key={value} variant={days===value?'default':'outline'} onClick={()=>setDays(value)}>{value} days</Button>)}<Button variant="outline" onClick={load}><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`} /></Button></div></div>{loading&&!metrics?<p>Loading metrics...</p>:<><div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label,value,Icon])=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Icon className="mb-4 h-5 w-5 text-indigo-600"/><p className="text-sm text-slate-500">{label}</p><p className="text-3xl font-bold text-slate-900">{value}</p></div>)}</div><div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3"><Ranking title="Traffic sources" rows={metrics?.sources||[]}/><Ranking title="Top pages" rows={metrics?.pages||[]}/><Ranking title="Started forms" rows={metrics?.forms||[]}/><Ranking title="Catalog searches" rows={metrics?.searches||[]}/><Ranking title="Tracked clicks" rows={metrics?.clicks||[]}/></div></>}</main></div>;
}

function AdminNav({ tab, setTab, logout }: { tab: 'metrics'|'builder'; setTab: (tab:'metrics'|'builder')=>void; logout:()=>void }) {
  return <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur"><div className="container mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3"><strong className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-lg text-transparent">Oky-Docky Admin</strong><nav className="flex items-center gap-2"><Button variant={tab==='metrics'?'default':'ghost'} onClick={()=>setTab('metrics')}><BarChart3 className="mr-2 h-4 w-4"/>Metrics</Button><Button variant={tab==='builder'?'default':'ghost'} onClick={()=>setTab('builder')}><FilePenLine className="mr-2 h-4 w-4"/>Builder</Button><Button variant="ghost" onClick={logout}><LogOut className="h-4 w-4"/></Button></nav></div></header>;
}
