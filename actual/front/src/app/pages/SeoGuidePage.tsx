import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import type { SeoGuide, TemplateMeta } from '../App';

export function SeoGuidePage() {
  const { templateId, guideSlug } = useParams<{ templateId: string; guideSlug: string }>();
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

  const guide: SeoGuide | undefined = template?.seo_guides?.find(
    (item) => item.slug === guideSlug && item.published !== false,
  );
  const canonical = `/${templateId}/${guideSlug}`;
  const faq = (guide?.faq || []).filter((item) => item.question.trim() && item.answer.trim());
  const graph = guide && template ? [
    {
      '@type': 'Article',
      headline: guide.heading,
      description: guide.description,
      mainEntityOfPage: `https://barckhat.com/oky-docky${canonical}`,
      about: template.title,
      publisher: { '@type': 'Organization', name: 'Oky-Docky' },
    },
    ...(faq.length ? [{ '@type': 'FAQPage', mainEntity: faq.map((item) => ({
      '@type': 'Question', name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })) }] : []),
  ] : [];

  useDocumentMeta({
    title: guide?.title || 'Guide | Oky-Docky',
    description: guide?.description,
    canonical,
    keywords: guide?.keywords?.join(', '),
    robots: guide ? 'index,follow,max-snippet:-1,max-image-preview:large' : 'noindex,follow',
    structuredData: guide ? { '@context': 'https://schema.org', '@graph': graph } : undefined,
  });

  if (missing || (template && !guide)) return <main className="mx-auto max-w-3xl px-6 py-24 text-center"><h1 className="text-3xl font-bold">Guide not found</h1><Button className="mt-6" onClick={() => navigate(`/${templateId}`)}>Back to form</Button></main>;
  if (!template || !guide) return <main className="flex min-h-screen items-center justify-center text-slate-500">Loading guide...</main>;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 text-slate-800">
      <article className="mx-auto max-w-4xl px-5 py-10">
        <Button variant="ghost" onClick={() => navigate(`/${template.id}`)} className="mb-8 gap-2"><ArrowLeft className="h-4 w-4" /> {template.title}</Button>
        <header className="rounded-3xl border border-white/70 bg-white/90 p-7 shadow-xl sm:p-12">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-indigo-700"><FileText className="h-5 w-5" /> {template.title} guide</div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">{guide.heading}</h1>
          <p className="mt-6 whitespace-pre-line text-lg leading-8 text-slate-600">{guide.intro}</p>
          <Button size="lg" className="mt-8" onClick={() => navigate(`/${template.id}/start`)}>Fill out {template.title} online</Button>
        </header>

        {guide.sections.filter((section) => section.heading.trim() && section.body.trim()).map((section) => (
          <section key={section.heading} className="py-9">
            <h2 className="text-3xl font-bold text-slate-900">{section.heading}</h2>
            <p className="mt-4 whitespace-pre-line text-lg leading-8 text-slate-600">{section.body}</p>
          </section>
        ))}

        {faq.length > 0 && <section className="py-9"><h2 className="mb-6 text-3xl font-bold">Frequently asked questions</h2>{faq.map((item) => <details key={item.question} className="mb-3 rounded-xl border bg-white p-5"><summary className="cursor-pointer font-semibold">{item.question}</summary><p className="mt-3 leading-7 text-slate-600">{item.answer}</p></details>)}</section>}

        <section className="rounded-2xl bg-indigo-950 p-7 text-white sm:p-10">
          <h2 className="text-2xl font-bold">Ready to complete {template.title}?</h2>
          <p className="mt-3 text-indigo-100">Use the guided questionnaire and download the prepared PDF.</p>
          <Button className="mt-5 bg-white text-indigo-950 hover:bg-indigo-50" onClick={() => navigate(`/${template.id}/start`)}>Start guided form</Button>
        </section>
      </article>
    </main>
  );
}
