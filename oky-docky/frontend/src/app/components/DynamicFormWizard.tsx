import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, FileText, Check, Eye, Loader } from 'lucide-react';
import { Button } from './ui/button';
import { FormDefinition, FormField, FormStep } from '../types/form-schema';
import { DynamicField } from './DynamicField';
import { fetchFormDefinition, submitForm } from '../api/mockApi';
import { toast } from 'sonner';

interface DynamicFormWizardProps {
  documentId: string;
  onClose: () => void;
}

export function DynamicFormWizard({ documentId, onClose }: DynamicFormWizardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formDefinition, setFormDefinition] = useState<FormDefinition | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load form definition from backend on mount
  useEffect(() => {
    loadFormDefinition();
  }, [documentId]);

  const loadFormDefinition = async () => {
    setIsLoading(true);
    try {
      const definition = await fetchFormDefinition(documentId);
      setFormDefinition(definition);
      
      // Initialize form data with default values
      const initialData: Record<string, any> = {};
      definition.steps.forEach((step) => {
        step.fields.forEach((field) => {
          if (field.defaultValue !== undefined) {
            initialData[field.id] = field.defaultValue;
          }
        });
      });
      setFormData(initialData);
    } catch (error) {
      console.error('Failed to load form:', error);
      toast.error('Failed to load form definition');
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error when user starts typing
    if (errors[fieldId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const validateField = (field: FormField, value: any): string | null => {
    if (!field.validations) return null;

    for (const validation of field.validations) {
      switch (validation.type) {
        case 'required':
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            return validation.message;
          }
          break;
        case 'minLength':
          if (typeof value === 'string' && value.length < (validation.value as number)) {
            return validation.message;
          }
          break;
        case 'maxLength':
          if (typeof value === 'string' && value.length > (validation.value as number)) {
            return validation.message;
          }
          break;
        case 'pattern':
          if (typeof value === 'string') {
            const regex = new RegExp(validation.value as string);
            if (!regex.test(value)) {
              return validation.message;
            }
          }
          break;
        case 'min':
          if (typeof value === 'number' && value < (validation.value as number)) {
            return validation.message;
          }
          break;
        case 'max':
          if (typeof value === 'number' && value > (validation.value as number)) {
            return validation.message;
          }
          break;
        case 'email':
          if (typeof value === 'string') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              return validation.message;
            }
          }
          break;
      }
    }
    return null;
  };

  const validateCurrentStep = (): boolean => {
    if (!formDefinition) return false;

    const currentStepData = formDefinition.steps[currentStep];
    const newErrors: Record<string, string> = {};

    currentStepData.fields.forEach((field) => {
      // Check if field should be visible based on conditional logic
      if (field.conditional && !evaluateConditional(field.conditional)) {
        return; // Skip validation for hidden fields
      }

      const value = formData[field.id];
      const error = validateField(field, value);
      if (error) {
        newErrors[field.id] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const evaluateConditional = (conditional: any): boolean => {
    const watchedFieldValue = formData[conditional.field];

    switch (conditional.operator) {
      case 'equals':
        return watchedFieldValue === conditional.value;
      case 'notEquals':
        return watchedFieldValue !== conditional.value;
      case 'contains':
        return (
          typeof watchedFieldValue === 'string' &&
          watchedFieldValue.includes(conditional.value)
        );
      case 'greaterThan':
        return Number(watchedFieldValue) > Number(conditional.value);
      case 'lessThan':
        return Number(watchedFieldValue) < Number(conditional.value);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!formDefinition) return;

    if (validateCurrentStep()) {
      if (currentStep < formDefinition.steps.length - 1) {
        setCurrentStep(currentStep + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      toast.error('Please fix the errors before continuing');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (!formDefinition) return;

    if (!validateCurrentStep()) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitForm(documentId, formData);
      
      if (result.success) {
        toast.success(result.message);
        if (result.pdfUrl) {
          toast.info('Your document is ready for download');
          // In production, you might want to open the PDF or trigger download
          console.log('PDF URL:', result.pdfUrl);
        }
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error('Failed to submit form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreview = () => {
    console.log('Form data for preview:', formData);
    toast.info('Preview functionality will show PDF preview');
    // In production, call preview API endpoint
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
        <div className="text-center">
          <Loader className="mx-auto h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (!formDefinition) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Form not found</p>
          <Button onClick={onClose} className="mt-4">
            Back to Catalog
          </Button>
        </div>
      </div>
    );
  }

  const totalSteps = formDefinition.steps.length;
  const currentStepData = formDefinition.steps[currentStep];

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={onClose}
              className="gap-2 hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Catalog
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 shadow-md shadow-blue-600/30">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">{formDefinition.title}</h1>
                <p className="text-xs text-gray-500">{formDefinition.description}</p>
              </div>
            </div>
            <div className="w-32" />
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <div className="flex items-center justify-between">
            {formDefinition.steps.map((step, index) => (
              <div key={step.id} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-all ${
                      index < currentStep
                        ? 'border-green-500 bg-green-500 text-white shadow-md shadow-green-500/30'
                        : index === currentStep
                        ? 'border-blue-500 bg-blue-500 text-white shadow-md shadow-blue-500/30'
                        : 'border-gray-300 bg-white text-gray-400'
                    }`}
                  >
                    {index < currentStep ? <Check className="h-5 w-5" /> : index + 1}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      index <= currentStep ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
                {index < totalSteps - 1 && (
                  <div
                    className={`mx-2 h-0.5 flex-1 ${
                      index < currentStep ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-auto py-8">
        <div className="mx-auto max-w-2xl px-6">
          <div
            className="rounded-xl border-2 border-gray-300 bg-white p-8 shadow-xl"
            style={{
              backgroundImage: `
                repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 2px,
                  rgba(0, 0, 0, 0.02) 2px,
                  rgba(0, 0, 0, 0.02) 4px
                )
              `,
              boxShadow:
                '0 10px 25px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
            }}
          >
            <div className="space-y-6">
              <div className="mb-6 border-b-2 border-gray-200 pb-4">
                <h2 className="font-semibold text-gray-900">
                  {currentStepData.title}
                </h2>
                <p className="text-sm text-gray-600">{currentStepData.description}</p>
              </div>

              {/* Dynamic Fields */}
              <div className="grid grid-cols-3 gap-4">
                {currentStepData.fields.map((field) => {
                  // Check conditional visibility
                  if (field.conditional && !evaluateConditional(field.conditional)) {
                    return null;
                  }

                  return (
                    <DynamicField
                      key={field.id}
                      field={field}
                      value={formData[field.id]}
                      onChange={(value) => updateFormData(field.id, value)}
                      error={errors[field.id]}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="border-t bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Button
              onClick={handleBack}
              disabled={currentStep === 0}
              variant="outline"
              className="gap-2 rounded-lg border-2 border-gray-300 px-6 py-2.5 font-medium shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="flex gap-3">
              {currentStep === totalSteps - 1 && (
                <Button
                  onClick={handlePreview}
                  variant="outline"
                  className="gap-2 rounded-lg border-2 border-blue-300 bg-blue-50 px-6 py-2.5 font-medium text-blue-700 shadow-sm hover:bg-blue-100"
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
              )}
              {currentStep < totalSteps - 1 ? (
                <Button
                  onClick={handleNext}
                  className="gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 font-medium text-white shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40"
                  style={{
                    boxShadow:
                      '0 4px 6px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  }}
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="gap-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-2.5 font-medium text-white shadow-md shadow-green-500/30 hover:shadow-lg hover:shadow-green-500/40 disabled:opacity-50"
                  style={{
                    boxShadow:
                      '0 4px 6px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Submit Form
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}