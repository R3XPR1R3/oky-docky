import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, ArrowLeft, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Checkbox } from './ui/checkbox';
import { Progress } from './ui/progress';
import { SignaturePad } from './SignaturePad';
import { useTranslation } from '../i18n/I18nContext';
import type { Schema, SchemaField } from '../App';
import { formatInputValue } from '../lib/inputFormatting';

interface QuestionFlowProps {
  templateId?: string;
  templateTitle: string;
  schema: Schema;
  initialData: Record<string, any>;
  onComplete: (data: Record<string, any>) => void;
  onBack: () => void;
}

function matchesConditions(conditions: Record<string, string[]> | undefined, answers: Record<string, any>) {
  if (!conditions) return true;
  return Object.entries(conditions).every(([key, allowed]) => {
    const answer = answers[key];
    return answer !== undefined && answer !== null && answer !== ''
      && allowed.map(String).includes(String(answer));
  });
}

function isVisible(field: SchemaField, answers: Record<string, any>) {
  if (field.hidden) return false;
  if (field.visible_when_any?.length) {
    return field.visible_when_any.some((conditions) => matchesConditions(conditions, answers));
  }
  return matchesConditions(field.visible_when, answers);
}

function formatDateAnswer(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : isoDate;
}

function dateAnswerToIso(value: unknown) {
  const raw = String(value || '');
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : raw;
}

function todayForFormat(format = 'MM/DD/YYYY') {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  return format.replace('MM', mm).replace('DD', dd).replace('YYYY', yyyy);
}

export function QuestionFlow({ templateId, templateTitle, schema, initialData, onComplete, onBack }: QuestionFlowProps) {
  const { t } = useTranslation();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>(() => {
    const values = { ...initialData };
    for (const field of schema.fields) {
      if (field.hidden && field.defaultValue !== undefined && values[field.key] === undefined) {
        values[field.key] = field.defaultValue;
      }
    }
    for (const transform of schema.transforms || []) {
      if (transform.type === 'auto_date' && transform.field && !values[transform.field]) {
        values[transform.field] = todayForFormat(transform.format);
      }
    }
    return values;
  });
  const visibleQuestions = useMemo(
    () => schema.fields.filter((field) => isVisible(field, answers)),
    [schema.fields, answers],
  );

  useEffect(() => {
    if (currentQuestionIndex >= visibleQuestions.length) {
      setCurrentQuestionIndex(Math.max(0, visibleQuestions.length - 1));
    }
  }, [currentQuestionIndex, visibleQuestions.length]);

  const currentQuestion = visibleQuestions[currentQuestionIndex];
  const progress = visibleQuestions.length > 0
    ? ((currentQuestionIndex + 1) / visibleQuestions.length) * 100
    : 0;

  const handleNext = () => {
    if (currentQuestionIndex < visibleQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      const visibleKeys = new Set(visibleQuestions.map((q) => q.key));
      const cleanData: Record<string, any> = {};
      for (const [key, value] of Object.entries(answers)) {
        if (visibleKeys.has(key)) cleanData[key] = value;
      }
      onComplete(cleanData);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else {
      onBack();
    }
  };

  const handleAnswerChange = (value: any) => {
    if (!currentQuestion) return;

    const nextValue = (currentQuestion.type === 'text' || currentQuestion.type === 'text_input') && typeof value === 'string'
      ? formatInputValue(currentQuestion.key, value, currentQuestion.inputMask)
      : value;

    setAnswers((prev) => ({ ...prev, [currentQuestion.key]: nextValue }));
  };

  const isCurrentAnswerValid = () => {
    if (!currentQuestion) return false;
    if (!currentQuestion.required) return true;
    const answer = answers[currentQuestion.key];
    if (currentQuestion.type === 'checkbox' || currentQuestion.type === 'checkbox_input') return answer === true;
    if (currentQuestion.type === 'signature' || currentQuestion.type === 'signature_area') {
      return typeof answer === 'string' && answer.trim() !== '';
    }
    if (answer === undefined || answer === null || answer.toString().trim() === '') return false;
    if (currentQuestion.inputMask) return String(answer).length === currentQuestion.inputMask.length;
    return true;
  };

  const canProceed = isCurrentAnswerValid();

  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="border-b border-white/20 backdrop-blur-sm bg-white/40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={handlePrevious}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{templateTitle}</span>
              </div>
            </div>
            <div className="text-sm text-slate-600">
              {t('questionFlow.questionOf', { current: String(currentQuestionIndex + 1), total: String(visibleQuestions.length) })}
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </motion.header>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <AnimatePresence mode="wait">
          <motion.div key={currentQuestion.key} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-8">
            <div className="bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-8 border-b border-slate-200">
                <div className="flex items-start gap-4">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Sparkles className="w-7 h-7 text-white" />
                  </motion.div>
                  <div className="flex-1">
                    <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-3xl font-bold text-slate-800 mb-2">{currentQuestion.label}</motion.h2>
                    {currentQuestion.helpText && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-slate-600">{currentQuestion.helpText}</motion.p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8">
                {currentQuestion.type === 'text' && (
                  <div className="space-y-2">
                    <Input value={answers[currentQuestion.key] || ''} onChange={(e) => handleAnswerChange(e.target.value)} placeholder={currentQuestion.placeholder} maxLength={currentQuestion.maxLength} className="text-lg px-6 py-6 rounded-xl border-2 focus:border-indigo-500 transition-colors" autoFocus />
                    {currentQuestion.inputMask && (
                      <p className="text-xs text-slate-400 font-mono pl-2">
                        Format: {currentQuestion.inputMask.replace(/D/g, '#').replace(/L/g, 'A').replace(/A/g, '*')}
                      </p>
                    )}
                  </div>
                )}

                {currentQuestion.type === 'date' && (
                  <div className="space-y-2">
                    <Input
                      type="date"
                      value={dateAnswerToIso(answers[currentQuestion.key])}
                      onChange={(e) => handleAnswerChange(formatDateAnswer(e.target.value))}
                      className="text-lg px-6 py-6 rounded-xl border-2 focus:border-indigo-500 transition-colors"
                      autoFocus
                    />
                    <p className="text-xs text-slate-400 pl-2">The date is saved as MM/DD/YYYY in the PDF.</p>
                  </div>
                )}

                {currentQuestion.type === 'radio' && currentQuestion.options && (
                  <RadioGroup value={answers[currentQuestion.key]} onValueChange={handleAnswerChange} className="space-y-3">
                    {currentQuestion.options.map((option) => (
                      <motion.div key={option.value} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={`relative flex items-center space-x-4 p-5 rounded-xl border-2 cursor-pointer transition-all ${answers[currentQuestion.key] === option.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}>
                        <RadioGroupItem value={option.value} id={option.value} />
                        <Label htmlFor={option.value} className="flex-1 cursor-pointer text-base">{option.label}</Label>
                        {answers[currentQuestion.key] === option.value && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
                            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </RadioGroup>
                )}

                {currentQuestion.type === 'checkbox' && (
                  <div className="flex items-center space-x-4 p-5 rounded-xl border-2 border-slate-200">
                    <Checkbox id={currentQuestion.key} checked={!!answers[currentQuestion.key]} onCheckedChange={(checked) => handleAnswerChange(checked)} />
                    <Label htmlFor={currentQuestion.key} className="flex-1 cursor-pointer text-base">{currentQuestion.helpText || t('questionFlow.yes')}</Label>
                  </div>
                )}

                {currentQuestion.type === 'signature' && (
                  <SignaturePad value={answers[currentQuestion.key] || ''} onChange={handleAnswerChange} />
                )}

                {currentQuestion.type === 'text_input' && (
                  <div className="space-y-2">
                    <Input
                      value={answers[currentQuestion.key] || ''}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      placeholder={currentQuestion.placeholder}
                      maxLength={currentQuestion.maxLength}
                      id={currentQuestion.fieldId || currentQuestion.key}
                      className="rounded-xl border-2 focus:border-indigo-500 transition-colors"
                      style={{
                        width: currentQuestion.style?.width || '100%',
                        height: currentQuestion.style?.height || undefined,
                        fontSize: currentQuestion.style?.fontSize || '1.125rem',
                        fontFamily: currentQuestion.style?.fontFamily || undefined,
                        padding: '0.75rem 1.5rem',
                      }}
                      autoFocus
                    />
                  </div>
                )}

                {currentQuestion.type === 'checkbox_input' && (
                  <div
                    className="flex items-center space-x-4 p-5 rounded-xl border-2 border-slate-200"
                    style={{
                      width: currentQuestion.style?.width || undefined,
                      height: currentQuestion.style?.height || undefined,
                    }}
                  >
                    <Checkbox
                      id={currentQuestion.fieldId || currentQuestion.key}
                      checked={!!answers[currentQuestion.key]}
                      onCheckedChange={(checked) => handleAnswerChange(checked)}
                    />
                    <Label
                      htmlFor={currentQuestion.fieldId || currentQuestion.key}
                      className="flex-1 cursor-pointer text-base"
                    >
                      {currentQuestion.helpText || currentQuestion.label}
                    </Label>
                  </div>
                )}

                {currentQuestion.type === 'signature_area' && (
                  <div
                    id={currentQuestion.fieldId || currentQuestion.key}
                    style={{
                      width: currentQuestion.style?.width || '100%',
                      height: currentQuestion.style?.height || undefined,
                    }}
                  >
                    <SignaturePad value={answers[currentQuestion.key] || ''} onChange={handleAnswerChange} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Button variant="outline" size="lg" onClick={handlePrevious} className="px-8 py-6 rounded-xl text-base">
                <ArrowLeft className="w-5 h-5 mr-2" />
                {t('questionFlow.back')}
              </Button>
              <Button size="lg" onClick={handleNext} disabled={!canProceed} className={`px-8 py-6 rounded-xl text-base ${canProceed ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}>
                {currentQuestionIndex === visibleQuestions.length - 1 ? t('questionFlow.review') : t('questionFlow.continue')}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2">
              {visibleQuestions.map((q, index) => (
                <motion.div key={q.key} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: index * 0.05 }} className={`h-2 rounded-full transition-all duration-300 ${index <= currentQuestionIndex ? 'w-8 bg-gradient-to-r from-indigo-600 to-purple-600' : 'w-2 bg-slate-300'}`} />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
