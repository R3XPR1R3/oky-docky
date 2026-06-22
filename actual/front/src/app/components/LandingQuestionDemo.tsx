import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, MousePointer2, Sparkles } from 'lucide-react';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

type DemoQuestion = {
  key: string;
  label: string;
  helpText: string;
  type: 'text' | 'radio';
  answer: string;
  placeholder?: string;
  options?: string[];
};

const QUESTIONS: DemoQuestion[] = [
  {
    key: 'name',
    label: "What's your full name?",
    helpText: 'Enter it exactly as it should appear on your document.',
    type: 'text',
    answer: 'John Doe',
    placeholder: 'Full legal name',
  },
  {
    key: 'easier',
    label: 'Is Oky-Docky easier than filling forms manually?',
    helpText: 'Choose the answer that best matches your experience.',
    type: 'radio',
    answer: 'Yes, much easier',
    options: ['Yes, much easier', 'Not really'],
  },
  {
    key: 'current_document',
    label: 'Which document are you preparing today?',
    helpText: 'We will tailor the questions to the selected document.',
    type: 'radio',
    answer: 'Form W-4',
    options: ['Form W-4', 'Form W-9', 'Another document'],
  },
  {
    key: 'recommend',
    label: 'Would you recommend Oky-Docky to a friend?',
    helpText: 'Your answer helps us improve the guided experience.',
    type: 'radio',
    answer: 'Yes',
    options: ['Yes', 'Maybe', 'No'],
  },
  {
    key: 'next_document',
    label: 'What document would you complete next?',
    helpText: 'We are deciding which guided form to improve next.',
    type: 'radio',
    answer: 'Form W-9',
    options: ['Form W-9', 'Form I-9', 'Power of Attorney'],
  },
];

export function LandingQuestionDemo() {
  const reduceMotion = useReducedMotion();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [typedValue, setTypedValue] = useState('');
  const [selectedValue, setSelectedValue] = useState('');
  const [showPointer, setShowPointer] = useState(false);
  const question = QUESTIONS[questionIndex];
  const answered = question.type === 'text' ? typedValue === question.answer : selectedValue === question.answer;

  useEffect(() => {
    setTypedValue('');
    setSelectedValue('');
    setShowPointer(false);

    const timers: number[] = [];
    const later = (callback: () => void, delay: number) => {
      timers.push(window.setTimeout(callback, delay));
    };
    const advance = (delay: number) => later(
      () => setQuestionIndex((current) => (current + 1) % QUESTIONS.length),
      delay,
    );

    if (reduceMotion) {
      if (question.type === 'text') setTypedValue(question.answer);
      else setSelectedValue(question.answer);
      advance(2600);
    } else if (question.type === 'text') {
      question.answer.split('').forEach((_, characterIndex) => {
        later(() => setTypedValue(question.answer.slice(0, characterIndex + 1)), 700 + characterIndex * 650);
      });
      advance(700 + question.answer.length * 650 + 1500);
    } else {
      later(() => setShowPointer(true), 800);
      later(() => setSelectedValue(question.answer), 1300);
      later(() => setShowPointer(false), 1800);
      advance(2900);
    }

    return () => timers.forEach(window.clearTimeout);
  }, [questionIndex, question, reduceMotion]);

  return (
    <div className="relative mx-auto max-w-3xl">
      <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-r from-indigo-600 to-purple-600 opacity-20 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 bg-white/90 px-5 py-4 sm:px-7">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600"><Sparkles className="h-4 w-4 text-white" /></div>
              <span className="font-semibold text-slate-800">Oky-Docky guided form</span>
            </div>
            <span className="text-xs font-medium text-slate-500">Question {questionIndex + 1} of {QUESTIONS.length}</span>
          </div>
          <Progress value={((questionIndex + 1) / QUESTIONS.length) * 100} className="h-2" />
        </div>

        <div className="min-h-[470px] sm:min-h-[430px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={question.key}
              initial={reduceMotion ? false : { opacity: 0, x: 35 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -35 }}
              transition={{ duration: 0.35 }}
            >
              <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <motion.div initial={reduceMotion ? false : { scale: 0.7 }} animate={{ scale: 1 }} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg"><Sparkles className="h-6 w-6 text-white" /></motion.div>
                  <div>
                    <h2 className="text-xl font-bold leading-tight text-slate-900 sm:text-3xl">{question.label}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">{question.helpText}</p>
                  </div>
                </div>
              </div>

              <div className="relative p-6 sm:p-8">
                {question.type === 'text' ? (
                  <div className="relative">
                    <Input readOnly value={typedValue} placeholder={question.placeholder} className="h-14 rounded-xl border-2 px-5 text-lg focus:border-indigo-500" />
                    {!reduceMotion && typedValue !== question.answer && <span className="absolute right-4 top-1/2 h-6 w-0.5 -translate-y-1/2 animate-pulse bg-indigo-600" />}
                  </div>
                ) : (
                  <RadioGroup value={selectedValue} className="space-y-3">
                    {question.options?.map((option) => {
                      const selected = selectedValue === option;
                      return (
                        <div key={option} className={`flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${selected ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white'}`}>
                          <RadioGroupItem value={option} id={`demo-${question.key}-${option}`} />
                          <span className="flex-1 font-medium text-slate-800">{option}</span>
                          {selected && <motion.span initial={reduceMotion ? false : { scale: 0 }} animate={{ scale: 1 }} className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600"><Check className="h-4 w-4 text-white" /></motion.span>}
                        </div>
                      );
                    })}
                  </RadioGroup>
                )}

                <motion.div animate={{ opacity: answered ? 1 : 0.45 }} className="mt-6 flex justify-end">
                  <div className="inline-flex items-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 font-semibold text-white shadow-lg">Continue <ArrowRight className="ml-2 h-4 w-4" /></div>
                </motion.div>

                <AnimatePresence>
                  {showPointer && (
                    <motion.div initial={{ opacity: 0, x: 50, y: 25 }} animate={{ opacity: 1, x: 0, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.45 }} className="pointer-events-none absolute bottom-24 left-12 z-10 drop-shadow-lg sm:left-24">
                      <MousePointer2 className="h-9 w-9 fill-slate-900 text-white" />
                      <motion.span initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: [0.5, 1.5], opacity: [0, 0.35, 0] }} transition={{ delay: 0.45, duration: 0.55 }} className="absolute -left-2 -top-2 h-10 w-10 rounded-full bg-indigo-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-center gap-2 border-t border-slate-100 px-6 py-4" aria-hidden="true">
          {QUESTIONS.map((item, index) => <span key={item.key} className={`h-2 rounded-full transition-all duration-300 ${index === questionIndex ? 'w-8 bg-indigo-600' : 'w-2 bg-slate-300'}`} />)}
        </div>
      </div>
    </div>
  );
}
