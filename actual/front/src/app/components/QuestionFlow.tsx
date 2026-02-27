import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, ArrowLeft, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Checkbox } from './ui/checkbox';
import { Progress } from './ui/progress';
import { SignaturePad } from './SignaturePad';
import type { Schema, SchemaField } from '../App';

interface QuestionFlowProps {
  templateTitle: string;
  schema: Schema;
  initialData: Record<string, any>;
  onComplete: (data: Record<string, any>) => void;
  onBack: () => void;
}

/**
 * Evaluate whether a field should be visible based on current answers.
 * visible_when is a Record<string, string[]> — ALL conditions must match (AND logic).
 * Each condition: answers[fieldKey] must be one of the allowed values.
 */
function isFieldVisible(field: SchemaField, answers: Record<string, any>): boolean {
  if (!field.visible_when) return true;

  for (const [depKey, allowedValues] of Object.entries(field.visible_when)) {
    const currentValue = answers[depKey];
    if (currentValue === undefined || currentValue === null || currentValue === '') return false;
    if (!allowedValues.includes(String(currentValue))) return false;
  }
  return true;
}

export function QuestionFlow({ templateTitle, schema, initialData, onComplete, onBack }: QuestionFlowProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>(initialData);

  // Filter to only visible questions based on current answers
  const visibleQuestions = useMemo(() => {
    return schema.fields.filter((field) => isFieldVisible(field, answers));
  }, [schema.fields, answers]);

  const currentQuestion = visibleQuestions[currentQuestionIndex];
  const progress = visibleQuestions.length > 0
    ? ((currentQuestionIndex + 1) / visibleQuestions.length) * 100
    : 0;

  const handleNext = () => {
    if (currentQuestionIndex < visibleQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Strip out answers for fields that are no longer visible
      const visibleKeys = new Set(visibleQuestions.map((q) => q.key));
      const cleanData: Record<string, any> = {};
      for (const [key, value] of Object.entries(answers)) {
        if (visibleKeys.has(key)) {
          cleanData[key] = value;
        }
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
    const newAnswers = { ...answers, [currentQuestion.key]: value };

    // When a routing question changes, clear dependent answers that are no longer visible
    const newVisible = schema.fields.filter((f) => isFieldVisible(f, newAnswers));
    const newVisibleKeys = new Set(newVisible.map((f) => f.key));
    for (const key of Object.keys(newAnswers)) {
      if (!newVisibleKeys.has(key)) {
        // Check if this field has a visible_when — only clear conditional fields
        const field = schema.fields.find((f) => f.key === key);
        if (field?.visible_when) {
          delete newAnswers[key];
        }
      }
    }

    setAnswers(newAnswers);

    // If the current question index goes out of bounds due to visibility changes, clamp it
    const updatedVisible = schema.fields.filter((f) => isFieldVisible(f, newAnswers));
    if (currentQuestionIndex >= updatedVisible.length) {
      setCurrentQuestionIndex(Math.max(0, updatedVisible.length - 1));
    }
  };

  const isCurrentAnswerValid = () => {
    if (!currentQuestion) return false;
    if (!currentQuestion.required) return true;
    const answer = answers[currentQuestion.key];
    if (currentQuestion.type === 'checkbox') return true;
    if (currentQuestion.type === 'signature') {
      return typeof answer === 'string' && answer.trim() !== '';
    }
    return answer !== undefined && answer !== null && answer.toString().trim() !== '';
  };

  const canProceed = isCurrentAnswerValid();

  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-white/20 backdrop-blur-sm bg-white/40"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={handlePrevious}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {templateTitle}
                </span>
              </div>
            </div>
            <div className="text-sm text-slate-600">
              Question {currentQuestionIndex + 1} of {visibleQuestions.length}
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </motion.header>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.key}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {/* Question Card */}
            <div className="bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden">
              {/* Bot Avatar Section */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-8 border-b border-slate-200">
                <div className="flex items-start gap-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg"
                  >
                    <Sparkles className="w-7 h-7 text-white" />
                  </motion.div>
                  <div className="flex-1">
                    <motion.h2
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-3xl font-bold text-slate-800 mb-2"
                    >
                      {currentQuestion.label}
                    </motion.h2>
                    {currentQuestion.helpText && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-slate-600"
                      >
                        {currentQuestion.helpText}
                      </motion.p>
                    )}
                  </div>
                </div>
              </div>

              {/* Answer Section */}
              <div className="p-8">
                {currentQuestion.type === 'text' && (
                  <div className="space-y-2">
                    <Input
                      value={answers[currentQuestion.key] || ''}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      placeholder={currentQuestion.placeholder}
                      className="text-lg px-6 py-6 rounded-xl border-2 focus:border-indigo-500 transition-colors"
                      autoFocus
                    />
                  </div>
                )}

                {currentQuestion.type === 'radio' && currentQuestion.options && (
                  <RadioGroup
                    value={answers[currentQuestion.key]}
                    onValueChange={handleAnswerChange}
                    className="space-y-3"
                  >
                    {currentQuestion.options.map((option) => (
                      <motion.div
                        key={option.value}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`
                          relative flex items-center space-x-4 p-5 rounded-xl border-2 cursor-pointer transition-all
                          ${
                            answers[currentQuestion.key] === option.value
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-slate-200 bg-white hover:border-indigo-300'
                          }
                        `}
                      >
                        <RadioGroupItem value={option.value} id={option.value} />
                        <Label htmlFor={option.value} className="flex-1 cursor-pointer text-base">
                          {option.label}
                        </Label>
                        {answers[currentQuestion.key] === option.value && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          >
                            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </RadioGroup>
                )}

                {currentQuestion.type === 'checkbox' && (
                  <div className="flex items-center space-x-4 p-5 rounded-xl border-2 border-slate-200">
                    <Checkbox
                      id={currentQuestion.key}
                      checked={!!answers[currentQuestion.key]}
                      onCheckedChange={(checked) => handleAnswerChange(checked)}
                    />
                    <Label htmlFor={currentQuestion.key} className="flex-1 cursor-pointer text-base">
                      {currentQuestion.helpText || 'Yes'}
                    </Label>
                  </div>
                )}

                {currentQuestion.type === 'signature' && (
                  <SignaturePad
                    value={answers[currentQuestion.key] || ''}
                    onChange={handleAnswerChange}
                  />
                )}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="outline"
                size="lg"
                onClick={handlePrevious}
                className="px-8 py-6 rounded-xl text-base"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <Button
                size="lg"
                onClick={handleNext}
                disabled={!canProceed}
                className={`
                  px-8 py-6 rounded-xl text-base
                  ${
                    canProceed
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }
                `}
              >
                {currentQuestionIndex === visibleQuestions.length - 1 ? 'Review' : 'Continue'}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>

            {/* Progress Indicators */}
            <div className="flex items-center justify-center gap-2">
              {visibleQuestions.map((q, index) => (
                <motion.div
                  key={q.key}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={`
                    h-2 rounded-full transition-all duration-300
                    ${
                      index <= currentQuestionIndex
                        ? 'w-8 bg-gradient-to-r from-indigo-600 to-purple-600'
                        : 'w-2 bg-slate-300'
                    }
                  `}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
