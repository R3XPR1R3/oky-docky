import { motion } from 'motion/react';
import { FileText, ArrowLeft, ArrowRight, MessageCircle, Download, CheckCircle, MousePointerClick } from 'lucide-react';
import { Button } from './ui/button';
import { LanguageSelector } from './LanguageSelector';
import { useTranslation } from '../i18n/I18nContext';

interface HowItWorksProps {
  onBack: () => void;
  onGetStarted: () => void;
}

function MemphisShapes({ variant }: { variant: 1 | 2 | 3 }) {
  const shapes: Record<number, JSX.Element> = {
    1: (
      <>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} className="absolute -top-6 -right-6 w-20 h-20 rounded-full border-4 border-dashed border-pink-300 opacity-60" />
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} className="absolute bottom-4 -left-4 w-12 h-12 bg-yellow-300 rounded-lg rotate-12 opacity-50" />
        <motion.div className="absolute top-1/2 -right-3 w-6 h-6 bg-teal-400 rounded-full opacity-40" />
      </>
    ),
    2: (
      <>
        <motion.div animate={{ rotate: -360 }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }} className="absolute -top-4 -left-4 w-16 h-16 border-4 border-dashed border-teal-300 opacity-50" style={{ borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%' }} />
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="absolute -bottom-3 right-8 w-8 h-8 bg-pink-400 rounded-full opacity-40" />
        <motion.div className="absolute top-8 -right-5 w-10 h-4 bg-yellow-400 rounded-full rotate-45 opacity-50" />
      </>
    ),
    3: (
      <>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full border-4 border-dashed border-yellow-300 opacity-50" />
        <motion.div animate={{ x: [0, 8, 0] }} transition={{ duration: 4, repeat: Infinity }} className="absolute top-2 -left-3 w-8 h-8 bg-teal-300 rounded-lg rotate-45 opacity-50" />
        <motion.div className="absolute bottom-1/3 -left-4 w-5 h-5 bg-pink-300 rounded-full opacity-40" />
      </>
    ),
  };
  return shapes[variant] || null;
}

const STEP_ICONS = [MousePointerClick, MessageCircle, Download];
const STEP_COLORS = ['from-indigo-500 to-blue-500', 'from-purple-500 to-pink-500', 'from-teal-500 to-green-500'];
const STEP_ACCENTS = ['bg-indigo-100 text-indigo-600', 'bg-purple-100 text-purple-600', 'bg-teal-100 text-teal-600'];

function MiniFormPicker() {
  return (
    <div className="grid w-full max-w-sm grid-cols-2 gap-3">
      {['Form W-4', 'Form W-9'].map((name, index) => (
        <motion.div key={name} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.15 }} viewport={{ once: true }} className={`relative rounded-2xl border-2 bg-white p-4 shadow-lg ${index === 0 ? 'border-indigo-400' : 'border-slate-200'}`}>
          <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${index === 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}><FileText className="h-5 w-5" /></div>
          <p className="text-sm font-bold text-slate-800">{name}</p>
          <p className="mt-1 text-[10px] text-slate-500">Guided PDF form</p>
          {index === 0 && <motion.span animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600"><CheckCircle className="h-5 w-5 text-white" /></motion.span>}
        </motion.div>
      ))}
    </div>
  );
}

function MiniQuestionCard() {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-xl">
      <div className="border-b bg-gradient-to-r from-indigo-50 to-purple-50 p-4">
        <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600"><MessageCircle className="h-4 w-4 text-white" /></div><div><p className="text-sm font-bold text-slate-900">What is your full name?</p><p className="text-[10px] text-slate-500">Question 1 of 6</p></div></div>
      </div>
      <div className="p-4">
        <div className="rounded-xl border-2 border-indigo-300 bg-white px-4 py-3 text-sm text-slate-800">Jane Doe<span className="ml-0.5 animate-pulse text-indigo-600">|</span></div>
        <div className="mt-4 flex justify-end"><div className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white">Continue →</div></div>
      </div>
    </div>
  );
}

function MiniDownloadCard() {
  return (
    <div className="w-full max-w-sm rounded-2xl border-2 border-slate-200 bg-white p-5 text-center shadow-xl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100"><CheckCircle className="h-7 w-7 text-emerald-600" /></div>
      <p className="mt-3 text-base font-bold text-slate-900">Your document is ready</p>
      <p className="mt-1 text-[11px] text-slate-500">Review and download your completed PDF.</p>
      <div className="mx-auto mt-4 flex max-w-[210px] items-center gap-3 rounded-xl border bg-slate-50 p-3 text-left"><div className="flex h-10 w-9 items-center justify-center rounded bg-white shadow"><FileText className="h-5 w-5 text-indigo-600" /></div><div><p className="text-xs font-semibold text-slate-800">completed-form.pdf</p><p className="text-[10px] text-slate-500">PDF document</p></div></div>
      <div className="mx-auto mt-4 inline-flex items-center rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow"><Download className="mr-2 h-3.5 w-3.5" /> Download PDF</div>
    </div>
  );
}

export function HowItWorks({ onBack, onGetStarted }: HowItWorksProps) {
  const { t } = useTranslation();

  const illustrations = [
    <div key="1" className="flex min-h-56 w-full items-center justify-center"><MiniFormPicker /></div>,
    <div key="2" className="flex min-h-56 w-full items-center justify-center"><MiniQuestionCard /></div>,
    <div key="3" className="flex min-h-64 w-full items-center justify-center"><MiniDownloadCard /></div>,
  ];

  return (
    <div className="min-h-screen">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="border-b border-white/20 backdrop-blur-sm bg-white/40 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {t('app.name')}
              </span>
            </div>
          </div>
          <LanguageSelector />
        </div>
      </motion.header>

      <div className="container mx-auto px-4 pt-16 pb-8 max-w-4xl text-center">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            {t('howItWorks.heroTitle')}{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              {t('howItWorks.heroTitleHighlight')}
            </span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">{t('howItWorks.heroDescription')}</p>
        </motion.div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="space-y-24">
          {[0, 1, 2].map((index) => {
            const isReversed = index % 2 !== 0;
            const Icon = STEP_ICONS[index];
            return (
              <motion.div key={index} initial={{ y: 40, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.6, delay: 0.1 }} className={`flex flex-col ${isReversed ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-8 md:gap-12`}>
                <div className="relative w-full flex-1 md:w-auto">
                  <MemphisShapes variant={(index + 1) as 1 | 2 | 3} />
                  <div className="relative w-full overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-lg sm:p-8">
                    {illustrations[index]}
                  </div>
                </div>
                <div className="w-full flex-1 space-y-4 md:w-auto">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${STEP_ACCENTS[index]}`}>
                    <Icon className="w-4 h-4" />
                    Step {t(`howItWorks.steps.${index}.number` as any)}
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-slate-800">{t(`howItWorks.steps.${index}.title` as any)}</h2>
                  <p className="text-lg text-slate-600 leading-relaxed">{t(`howItWorks.steps.${index}.description` as any)}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <motion.div initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="container mx-auto px-4 py-24 max-w-3xl text-center">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-12 text-white relative overflow-hidden">
          <h2 className="text-3xl font-bold mb-4">{t('howItWorks.ctaTitle')}</h2>
          <p className="text-lg mb-8 opacity-90">{t('howItWorks.ctaDescription')}</p>
          <Button size="lg" onClick={onGetStarted} className="bg-white text-indigo-600 hover:bg-slate-50 px-8 py-6 text-lg rounded-xl shadow-lg">
            {t('howItWorks.ctaButton')}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
