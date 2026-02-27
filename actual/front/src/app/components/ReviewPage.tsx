import { useMemo } from 'react';
import { motion } from 'motion/react';
import { FileText, Edit2, CheckCircle, ArrowRight, Loader2, Pen } from 'lucide-react';
import { Button } from './ui/button';
import type { Schema, SchemaField } from '../App';

interface ReviewPageProps {
  formData: Record<string, any>;
  schema: Schema;
  templateTitle: string;
  onEdit: () => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

export function ReviewPage({ formData, schema, templateTitle, onEdit, onSubmit, isLoading = false }: ReviewPageProps) {
  // Build lookup maps from schema
  const fieldMap = new Map<string, SchemaField>();
  for (const f of schema.fields) {
    fieldMap.set(f.key, f);
  }

  // Routing-only keys: auto-detect from schema fields with routing: true
  const routingKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const f of schema.fields) {
      if ((f as any).routing) keys.add(f.key);
    }
    // W-9 backwards compatibility — these were hardcoded before the routing flag existed
    for (const k of ['entity_type', 'tin_type', 'has_exemptions']) keys.add(k);
    return keys;
  }, [schema.fields]);

  const formatValue = (key: string, value: any): string => {
    if (value === undefined || value === null || value === '') return 'Not provided';

    const field = fieldMap.get(key);

    // For radio fields, show the option label instead of the raw value
    if (field?.type === 'radio' && field.options) {
      const opt = field.options.find((o) => o.value === value);
      if (opt) return opt.label;
    }

    // For checkbox, show Yes/No
    if (field?.type === 'checkbox') {
      return value ? 'Yes' : 'No';
    }

    // Signature fields
    if (field?.type === 'signature') {
      if (typeof value === 'string' && value.startsWith('data:image')) {
        return '__SIGNATURE_IMAGE__';
      }
      return value ? `Signed: ${value}` : 'Not signed';
    }

    // Mask SSN/TIN/EIN-like fields for display
    if (key === 'ssn' || key === 'tin') {
      const str = value.toString().replace(/\D/g, '');
      if (str.length >= 4) return '\u2022\u2022\u2022-\u2022\u2022-' + str.slice(-4);
      return '\u2022\u2022\u2022\u2022';
    }
    if (key === 'ein') {
      const str = value.toString().replace(/\D/g, '');
      if (str.length >= 4) return '\u2022\u2022-\u2022\u2022\u2022' + str.slice(-4);
      return '\u2022\u2022\u2022\u2022';
    }

    return value.toString();
  };

  const getLabel = (key: string): string => {
    const field = fieldMap.get(key);
    return field?.label || key;
  };

  // Only show fields that: exist in formData, are in the schema, are not routing-only keys
  const displayFields = schema.fields.filter(
    (f) => f.key in formData && !routingKeys.has(f.key)
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-white/20 backdrop-blur-sm bg-white/40"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Oky-Docky
            </span>
          </div>
        </div>
      </motion.header>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Title Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 mb-6"
          >
            <CheckCircle className="w-10 h-10 text-green-600" />
          </motion.div>
          <h1 className="text-5xl font-bold mb-4">Almost done!</h1>
          <p className="text-xl text-slate-600">
            Review your information before we generate your {templateTitle}
          </p>
        </motion.div>

        {/* Review Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 overflow-hidden mb-8"
        >
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-8 py-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Your Information</h2>
                <p className="text-slate-600 mt-1">Please verify all details are correct</p>
              </div>
              <Button variant="outline" onClick={onEdit} className="rounded-full">
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {displayFields.map((field, index) => (
              <motion.div
                key={field.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="px-8 py-6 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-500 mb-1">
                      {getLabel(field.key)}
                    </div>
                    {formatValue(field.key, formData[field.key]) === '__SIGNATURE_IMAGE__' ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={formData[field.key]}
                          alt="Signature"
                          className="h-12 border border-slate-200 rounded-lg bg-white px-2"
                        />
                        <div className="flex items-center gap-1 text-sm text-green-600">
                          <Pen className="w-3.5 h-3.5" />
                          Signed
                        </div>
                      </div>
                    ) : (
                      <div className="text-lg text-slate-800 font-medium">
                        {formatValue(field.key, formData[field.key])}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button
            variant="outline"
            size="lg"
            onClick={onEdit}
            className="w-full sm:w-auto px-8 py-6 rounded-xl text-base"
          >
            <Edit2 className="w-5 h-5 mr-2" />
            Make Changes
          </Button>
          <Button
            size="lg"
            onClick={onSubmit}
            disabled={isLoading}
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-6 rounded-xl text-base shadow-lg shadow-indigo-500/30 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                Generate My Document
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </motion.div>

        {/* Security Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 text-center"
        >
          <div className="inline-flex items-center gap-2 text-sm text-slate-600 bg-white/60 backdrop-blur-sm px-6 py-3 rounded-full border border-slate-200">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>Your information is secure and encrypted</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
