import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import type { TemplateMeta } from '../App';

export function TemplateLandingPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<TemplateMeta | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!templateId) return;
    fetch(`/api/templates/${templateId}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setTemplate)
      .catch(() => setMissing(true));
  }, [templateId]);

  const title = template?.seo_title || (template ? `${template.title} - Free Online Form | Oky-Docky` : 'Document form | Oky-Docky');
  const description = template?.seo_description || template?.description;
  const faq = (template?.seo_faq || []).filter((item) => item.question.trim() && item.answer.trim());
  const graph = template ? [
    {
      '@type': 'WebApplication', name: template.title, description, url: `https://barckhat.com/oky-docky/${template.id}`,
      applicationCategory: 'BusinessApplication', operatingSystem: 'Web', isAccessibleForFree: true,
      isBasedOn: template.source_url, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    ...(faq.length ? [{ '@type': 'FAQPage', mainEntity: faq.map((item) => ({
      '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })) }] : []),
  ] : [];

  useDocumentMeta({
    title,
    description,
    canonical: `/${templateId}`,
    ogTitle: template?.og_title || title,
    ogDescription: template?.og_description || description,
    ogImage: template?.og_image,
    keywords: template?.seo_keywords?.join(', '),
    robots: 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1',
    structuredData: template ? { '@context': 'https://schema.org', '@graph': graph } : undefined,
  });

  if (missing) return <main className="mx-auto max-w-3xl px-6 py-24 text-center"><h1 className="text-3xl font-bold">Form not found</h1><Button className="mt-6" onClick={() => navigate('/templates')}>Browse forms</Button></main>;
  if (!template) return <main className="flex min-h-screen items-center justify-center text-slate-500">Loading form...</main>;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 text-slate-800">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <Button variant="ghost" onClick={() => navigate('/templates')} className="mb-8 gap-2"><ArrowLeft className="h-4 w-4" /> All forms</Button>
        <section className="rounded-3xl border border-white/70 bg-white/90 p-7 shadow-xl sm:p-12">
          <div className="mb-5 flex items-center gap-3 text-sm font-medium text-indigo-700"><FileText className="h-6 w-6" /> {template.category} · {template.estimated_time}</div>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">{template.seo_heading || `Fill out ${template.title} online`}</h1>
          <p className="mt-6 max-w-3xl whitespace-pre-line text-lg leading-8 text-slate-600">{template.seo_intro || template.seo_description || template.description}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button size="lg" onClick={() => navigate(`/${template.id}/start`)} className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 text-white">Start {template.title}</Button>
            <div className="flex items-center gap-2 text-sm text-slate-500"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Guided questions · Completed PDF</div>
          </div>
        </section>

        {(template.seo_sections || []).filter((section) => section.heading.trim() && section.body.trim()).map((section) => (
          <section key={section.heading} className="mx-auto max-w-4xl py-10">
            <h2 className="text-3xl font-bold text-slate-900">{section.heading}</h2>
            <p className="mt-4 whitespace-pre-line text-lg leading-8 text-slate-600">{section.body}</p>
          </section>
        ))}

        {faq.length > 0 && <section className="mx-auto max-w-4xl py-10"><h2 className="mb-6 text-3xl font-bold">Frequently asked questions</h2>{faq.map((item) => <details key={item.question} className="mb-3 rounded-xl border bg-white p-5"><summary className="cursor-pointer font-semibold">{item.question}</summary><p className="mt-3 leading-7 text-slate-600">{item.answer}</p></details>)}</section>}

        <section className="mx-auto max-w-4xl py-10">
          <h2 className="text-2xl font-bold">Ready to prepare your document?</h2>
          <div className="mt-4 flex flex-wrap items-center gap-4"><Button onClick={() => navigate(`/${template.id}/start`)}>Start guided form</Button><span className="flex items-center gap-2 text-sm text-slate-500"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Free to complete</span></div>
          {template.source_url && <p className="mt-8 text-sm text-slate-500">Official source: <a href={template.source_url} target="_blank" rel="noreferrer" className="text-indigo-700 underline">{template.source_authority || template.source_url}</a>{template.form_revision ? ` · Revision ${template.form_revision}` : ''}</p>}
        </section>
      </div>
    </main>
  );
}
