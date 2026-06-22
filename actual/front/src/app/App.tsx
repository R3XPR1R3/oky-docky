import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { I18nProvider, useTranslation } from './i18n/I18nContext';
import { LandingPage } from './components/LandingPage';
import { DocumentSelection } from './components/DocumentSelection';
import { ReviewPage } from './components/ReviewPage';
import { SuccessPage } from './components/SuccessPage';
import { ErrorDialog } from './components/ErrorDialog';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { HowItWorks } from './components/HowItWorks';
import { PricingPage } from './components/PricingPage';
import { DisclaimerPage } from './components/DisclaimerPage';
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage';
import { TemplatePage } from './pages/TemplatePage';
import { TemplateLandingPage } from './pages/TemplateLandingPage';
import { SeoGuidePage } from './pages/SeoGuidePage';
import { useDocumentMeta } from './hooks/useDocumentMeta';
import { AnalyticsTracker, trackEvent } from './lib/analytics';

export interface TemplateMeta {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  country: string;
  popular: boolean;
  estimated_time: string;
  published?: boolean;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
  seo_heading?: string;
  seo_intro?: string;
  seo_sections?: { heading: string; body: string }[];
  seo_faq?: { question: string; answer: string }[];
  seo_guides?: SeoGuide[];
  og_title?: string;
  og_description?: string;
  og_image?: string;
  partner_resources?: PartnerResource[];
  source_url?: string;
  source_authority?: string;
  form_revision?: string;
}

export interface FieldStyle {
  width?: string;       // e.g. "300px", "100%"
  height?: string;      // e.g. "40px", "200px"
  fontSize?: string;    // e.g. "14px", "1.2rem"
  fontFamily?: string;  // e.g. "Arial", "monospace"
}

export interface SeoGuide {
  slug: string;
  title: string;
  description: string;
  heading: string;
  intro: string;
  keywords?: string[];
  sections: { heading: string; body: string }[];
  faq?: { question: string; answer: string }[];
  published?: boolean;
}

export interface PartnerResource {
  title: string;
  description: string;
  button_label: string;
  url: string;
  placement: 'landing' | 'before_download' | 'both';
  disclosure?: string;
}

export type ConditionPrimitive = string | number | boolean | null;
export interface ConditionOperator {
  equals?: ConditionPrimitive;
  not_equals?: ConditionPrimitive;
  in?: ConditionPrimitive[];
  not_in?: ConditionPrimitive[];
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  empty?: boolean;
  truthy?: boolean;
}
export type ConditionExpected = ConditionPrimitive | ConditionPrimitive[] | ConditionOperator;
export type ConditionSet = Record<string, ConditionExpected>;

export interface SchemaField {
  key: string;
  type: 'text' | 'date' | 'radio' | 'checkbox' | 'signature' | 'text_input' | 'checkbox_input' | 'signature_area';
  required?: boolean;
  routing?: boolean;
  hidden?: boolean;
  label: string;
  placeholder?: string;
  helpText?: string;
  inputMask?: string;
  maxLength?: number;
  defaultValue?: string | number | boolean;
  options?: { value: string; label: string }[];
  visible_when?: ConditionSet;
  visible_when_any?: ConditionSet[];
  readOnly?: boolean;
  read_only_when?: ConditionSet;
  read_only_when_any?: ConditionSet[];
  fieldId?: string;     // custom ID for document mapping
  style?: FieldStyle;   // visual styling for document fields
}

export interface SchemaTransform {
  type: 'derive' | 'compute' | 'formula' | 'copy' | 'concat' | 'auto_date' | 'set_value';
  when?: ConditionSet;
  unless?: ConditionSet;
  set?: Record<string, any>;
  else_set?: Record<string, any>;
  operation?: string;
  input?: string;
  inputs?: string[];
  separator?: string;
  skip_empty?: boolean;
  factor?: number;
  divisor?: number;
  percent?: number;
  exp?: number;
  mod?: number;
  precision?: number;
  output?: string;
  outputs?: Record<string, string>;
  from?: string;
  to?: string;
  if_empty?: boolean;
  field?: string;
  format?: string;
  value?: any;
  else_value?: any;
}

export interface Schema {
  fields: SchemaField[];
  transforms?: SchemaTransform[];
}

// --- Page wrappers with SEO meta ---

function LandingRoute() {
  const navigate = useNavigate();
  useDocumentMeta({
    title: 'Oky-Docky — Smart Document Form Assistant',
    description: 'Complete tax forms and legal documents online for free. Guided Q&A with instant PDF download.',
    canonical: '/',
  });
  return (
    <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <LandingPage
        onGetStarted={() => navigate('/templates')}
        onHowItWorks={() => navigate('/how-it-works')}
        onPricing={() => navigate('/pricing')}
        onDisclaimer={() => navigate('/disclaimer')}
      />
    </motion.div>
  );
}

function SelectionRoute() {
  const navigate = useNavigate();
  const { locale, t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: 'Browse Forms & Documents — Oky-Docky',
    description: 'Browse and fill out tax forms, legal documents, and government paperwork online. Free guided Q&A with instant PDF generation.',
    canonical: '/templates',
  });

  const handleSelectDocument = async (template: TemplateMeta) => {
    try {
      trackEvent('click', { element: `template_card:${template.id}`, template_id: template.id });
      // Pre-validate the template exists, then navigate to its URL
      navigate(`/${template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.failedSchemaLoad'));
    }
  };

  return (
    <>
      <motion.div key="selection" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
        <DocumentSelection apiUrl="" onSelectDocument={handleSelectDocument} onBack={() => navigate('/')} />
      </motion.div>
      <ErrorDialog isOpen={!!error} message={error || ''} onClose={() => setError(null)} />
    </>
  );
}

function HowItWorksRoute() {
  const navigate = useNavigate();
  useDocumentMeta({
    title: 'How It Works — Oky-Docky',
    description: 'Learn how Oky-Docky helps you fill out tax forms and documents with our guided step-by-step process.',
    canonical: '/how-it-works',
  });
  return (
    <motion.div key="how-it-works" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
      <HowItWorks onBack={() => navigate('/')} onGetStarted={() => navigate('/templates')} />
    </motion.div>
  );
}

function PricingRoute() {
  const navigate = useNavigate();
  useDocumentMeta({
    title: 'Pricing — Oky-Docky',
    description: 'Oky-Docky pricing plans. Fill out forms for free with our guided document assistant.',
    canonical: '/pricing',
  });
  return (
    <motion.div key="pricing" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
      <PricingPage onBack={() => navigate('/')} onGetStarted={() => navigate('/templates')} />
    </motion.div>
  );
}

function DisclaimerRoute() {
  const navigate = useNavigate();
  useDocumentMeta({
    title: 'Terms & Disclaimer — Oky-Docky',
    description: 'Terms of service and legal disclaimer for Oky-Docky document form assistant.',
    canonical: '/disclaimer',
  });
  return (
    <motion.div key="disclaimer" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
      <DisclaimerPage onBack={() => navigate('/')} />
    </motion.div>
  );
}

function PrivacyRoute() {
  const navigate = useNavigate();
  useDocumentMeta({
    title: 'Privacy Policy | Oky-Docky',
    description: 'How Oky-Docky and Barckhat LLC handle form answers, generated documents, analytics, advertising, and service-provider data.',
    canonical: '/privacy',
  });
  return <PrivacyPolicyPage onBack={() => navigate(-1)} />;
}

function BuilderRoute() {
  return <Navigate to="/admin?tab=builder" replace />;
}

function AppRoutes() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <AnalyticsTracker />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<LandingRoute />} />
            <Route path="/templates" element={<SelectionRoute />} />
            <Route path="/how-it-works" element={<HowItWorksRoute />} />
            <Route path="/pricing" element={<PricingRoute />} />
            <Route path="/disclaimer" element={<DisclaimerRoute />} />
            <Route path="/privacy" element={<PrivacyRoute />} />
            <Route path="/builder" element={<BuilderRoute />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/:templateId/start" element={<TemplatePage />} />
            <Route path="/:templateId/:guideSlug" element={<SeoGuidePage />} />
            <Route path="/:templateId" element={<TemplateLandingPage />} />
          </Routes>
        </AnimatePresence>
      </div>
    </>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter basename="/oky-docky">
        <AppRoutes />
      </BrowserRouter>
    </I18nProvider>
  );
}
