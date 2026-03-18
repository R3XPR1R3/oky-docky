import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { I18nProvider, useTranslation } from './i18n/I18nContext';
import { LandingPage } from './components/LandingPage';
import { DocumentSelection } from './components/DocumentSelection';
import { ReviewPage } from './components/ReviewPage';
import { SuccessPage } from './components/SuccessPage';
import { ErrorDialog } from './components/ErrorDialog';
import { FormBuilder } from './components/FormBuilder';
import { HowItWorks } from './components/HowItWorks';
import { PricingPage } from './components/PricingPage';
import { DisclaimerPage } from './components/DisclaimerPage';
import { TemplatePage } from './pages/TemplatePage';
import { useDocumentMeta } from './hooks/useDocumentMeta';

export interface TemplateMeta {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  country: string;
  popular: boolean;
  estimated_time: string;
}

export interface FieldStyle {
  width?: string;       // e.g. "300px", "100%"
  height?: string;      // e.g. "40px", "200px"
  fontSize?: string;    // e.g. "14px", "1.2rem"
  fontFamily?: string;  // e.g. "Arial", "monospace"
}

export interface SchemaField {
  key: string;
  type: 'text' | 'radio' | 'checkbox' | 'signature' | 'text_input' | 'checkbox_input' | 'signature_area';
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
  visible_when?: Record<string, string[]>;
  visible_when_any?: Record<string, string[]>[];
  fieldId?: string;     // custom ID for document mapping
  style?: FieldStyle;   // visual styling for document fields
}

export interface SchemaTransform {
  type: 'derive' | 'compute' | 'copy' | 'auto_date' | 'set_value';
  when?: Record<string, string | string[] | boolean>;
  set?: Record<string, any>;
  operation?: string;
  input?: string;
  inputs?: string[];
  factor?: number;
  output?: string;
  from?: string;
  to?: string;
  if_empty?: boolean;
  field?: string;
  format?: string;
  value?: any;
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

function BuilderRoute() {
  const navigate = useNavigate();
  useDocumentMeta({
    title: 'Form Builder — Oky-Docky',
    description: 'Build and edit document form templates with our visual form builder.',
    canonical: '/builder',
  });
  return (
    <motion.div key="builder" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
      <FormBuilder onBack={() => navigate('/')} />
    </motion.div>
  );
}

function AppRoutes() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<LandingRoute />} />
            <Route path="/templates" element={<SelectionRoute />} />
            <Route path="/how-it-works" element={<HowItWorksRoute />} />
            <Route path="/pricing" element={<PricingRoute />} />
            <Route path="/disclaimer" element={<DisclaimerRoute />} />
            <Route path="/builder" element={<BuilderRoute />} />
            <Route path="/:templateId" element={<TemplatePage />} />
          </Routes>
        </AnimatePresence>
      </div>
    </>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </I18nProvider>
  );
}
