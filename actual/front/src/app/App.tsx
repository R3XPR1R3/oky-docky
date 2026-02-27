import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { LandingPage } from './components/LandingPage';
import { DocumentSelection } from './components/DocumentSelection';
import { QuestionFlow } from './components/QuestionFlow';
import { ReviewPage } from './components/ReviewPage';
import { SuccessPage } from './components/SuccessPage';
import { ErrorDialog } from './components/ErrorDialog';
import { FormBuilder } from './components/FormBuilder';

type Step = 'landing' | 'selection' | 'questions' | 'review' | 'success' | 'builder';

const API_URL = '';

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

export interface SchemaField {
  key: string;
  type: 'text' | 'radio' | 'checkbox';
  required?: boolean;
  label: string;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
  visible_when?: Record<string, string[]>;
}

export interface Schema {
  fields: SchemaField[];
}

export default function App() {
  const [currentStep, setCurrentStep] = useState<Step>('landing');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateMeta | null>(null);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetStarted = () => {
    setCurrentStep('selection');
  };

  const handleSelectDocument = async (template: TemplateMeta) => {
    setSelectedTemplate(template);
    try {
      const res = await fetch(`${API_URL}/api/templates/${template.id}/schema`);
      if (!res.ok) throw new Error(`Failed to load schema: ${res.status}`);
      const data: Schema = await res.json();
      setSchema(data);
      setCurrentStep('questions');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load form schema';
      setError(msg);
    }
  };

  const handleCompleteQuestions = (data: Record<string, any>) => {
    setFormData(data);
    setCurrentStep('review');
  };

  const handleEditQuestions = () => {
    setCurrentStep('questions');
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) return;

    setIsLoading(true);
    setError(null);

    try {
      toast.success('Generating your document...');
      const response = await fetch(`${API_URL}/api/render/${selectedTemplate.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: formData }),
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setCurrentStep('success');
      toast.success('Document generated successfully!');
    } catch (err) {
      let errorMessage = 'Failed to generate PDF. ';
      if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMessage += 'Cannot connect to the backend server. Please ensure the FastAPI server is running.';
      } else if (err instanceof Error) {
        errorMessage += err.message;
      }
      setError(errorMessage);
      toast.error('Failed to generate document');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOver = () => {
    setCurrentStep('landing');
    setSelectedTemplate(null);
    setSchema(null);
    setFormData({});
    setPdfUrl(null);
    setError(null);
  };

  const handleCloseError = () => {
    setError(null);
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <AnimatePresence mode="wait">
          {currentStep === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <LandingPage onGetStarted={handleGetStarted} onOpenBuilder={() => setCurrentStep('builder')} />
            </motion.div>
          )}

          {currentStep === 'selection' && (
            <motion.div
              key="selection"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DocumentSelection
                apiUrl={API_URL}
                onSelectDocument={handleSelectDocument}
                onBack={() => setCurrentStep('landing')}
              />
            </motion.div>
          )}

          {currentStep === 'questions' && selectedTemplate && schema && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <QuestionFlow
                templateTitle={selectedTemplate.title}
                schema={schema}
                initialData={formData}
                onComplete={handleCompleteQuestions}
                onBack={() => setCurrentStep('selection')}
              />
            </motion.div>
          )}

          {currentStep === 'review' && selectedTemplate && schema && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ReviewPage
                formData={formData}
                schema={schema}
                templateTitle={selectedTemplate.title}
                onEdit={handleEditQuestions}
                onSubmit={handleSubmit}
                isLoading={isLoading}
              />
            </motion.div>
          )}

          {currentStep === 'success' && pdfUrl && selectedTemplate && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <SuccessPage
                pdfUrl={pdfUrl}
                templateTitle={selectedTemplate.title}
                onStartOver={handleStartOver}
              />
            </motion.div>
          )}
          {currentStep === 'builder' && (
            <motion.div
              key="builder"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <FormBuilder onBack={() => setCurrentStep('landing')} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ErrorDialog
        isOpen={!!error}
        message={error || ''}
        onClose={handleCloseError}
      />
    </>
  );
}
