import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { QuestionFlow } from '../components/QuestionFlow';
import { ReviewPage } from '../components/ReviewPage';
import { AdInterstitial } from '../components/AdInterstitial';
import { SuccessPage } from '../components/SuccessPage';
import { ErrorDialog } from '../components/ErrorDialog';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useTranslation } from '../i18n/I18nContext';
import type { TemplateMeta, Schema } from '../App';
import { trackEvent } from '../lib/analytics';

type Phase = 'loading' | 'questions' | 'review' | 'ad' | 'success';

export function TemplatePage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { locale, t } = useTranslation();

  const [phase, setPhase] = useState<Phase>('loading');
  const [template, setTemplate] = useState<TemplateMeta | null>(null);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startTracked = useRef(false);

  useDocumentMeta({
    title: template ? (template.seo_title || `${template.title} — Free Online Form | Oky-Docky`) : 'Loading... | Oky-Docky',
    description: template
      ? (template.seo_description || `Fill out ${template.title} online for free. ${template.description} Guided step-by-step Q&A with instant PDF download.`)
      : undefined,
    canonical: `/${templateId}`,
    keywords: template
      ? (template.seo_keywords || [template.title, template.category, template.country, ...template.tags, 'free online form', 'PDF form filler', 'document assistant']).filter(Boolean).join(', ')
      : undefined,
    structuredData: template ? {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: template.title,
      description: template.seo_description || template.description,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      isAccessibleForFree: true,
      isBasedOn: template.source_url,
      publisher: { '@type': 'Organization', name: 'Oky-Docky' },
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    } : undefined,
  });

  useEffect(() => {
    if (!templateId) return;

    let cancelled = false;
    (async () => {
      try {
        const [metaRes, schemaRes] = await Promise.all([
          fetch(`/api/templates/${templateId}`),
          fetch(`/api/templates/${templateId}/schema?locale=${locale}`),
        ]);

        if (!metaRes.ok || !schemaRes.ok) {
          if (!cancelled) {
            setError(`Template "${templateId}" not found`);
          }
          return;
        }

        const metaData = await metaRes.json();
        const schemaData = await schemaRes.json();

        if (!cancelled) {
          setTemplate(metaData);
          setSchema(schemaData);
          setPhase('questions');
          if (!startTracked.current) {
            trackEvent('form_start', { template_id: templateId });
            startTracked.current = true;
          }
        }
      } catch {
        if (!cancelled) setError('Failed to load template');
      }
    })();

    return () => { cancelled = true; };
  }, [templateId, locale]);

  const handleComplete = (data: Record<string, any>) => {
    setFormData(data);
    setPhase('review');
  };

  const handleSubmit = async () => {
    if (!template) return;
    setIsLoading(true);
    setError(null);

    try {
      toast.success(t('error.generatingToast'));
      const response = await fetch(`/api/render/${template.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: formData }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const blob = await response.blob();
      setPdfUrl(URL.createObjectURL(blob));
      trackEvent('form_complete', { template_id: template.id });
      setPhase('ad');
      toast.success(t('error.generatedToast'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
      toast.error(t('error.failedToGenerateToast'));
    } finally {
      setIsLoading(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading {templateId}...</p>
        </motion.div>
        <ErrorDialog isOpen={!!error} message={error || ''} onClose={() => navigate('/templates')} />
      </div>
    );
  }

  if (phase === 'questions' && template && schema) {
    return (
      <>
        <QuestionFlow
          templateId={template.id}
          templateTitle={template.title}
          schema={schema}
          initialData={formData}
          onComplete={handleComplete}
          onBack={() => navigate('/templates')}
        />
        <ErrorDialog isOpen={!!error} message={error || ''} onClose={() => setError(null)} />
      </>
    );
  }

  if (phase === 'review' && template && schema) {
    return (
      <>
        <ReviewPage
          formData={formData}
          schema={schema}
          templateTitle={template.title}
          onEdit={() => setPhase('questions')}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
        <ErrorDialog isOpen={!!error} message={error || ''} onClose={() => setError(null)} />
      </>
    );
  }

  if (phase === 'ad' && pdfUrl && template) {
    return (
      <AdInterstitial
        templateTitle={template.title}
        onComplete={() => setPhase('success')}
      />
    );
  }

  if (phase === 'success' && pdfUrl && template) {
    return (
      <SuccessPage
        pdfUrl={pdfUrl}
        templateId={template.id}
        templateTitle={template.title}
        onStartOver={() => navigate('/')}
      />
    );
  }

  return null;
}
