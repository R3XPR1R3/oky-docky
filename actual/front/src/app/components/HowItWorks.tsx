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

export function HowItWorks({ onBack, onGetStarted }: HowItWorksProps) {
  const { t } = useTranslation();

  const illustrations = [
    // Step 1 - Pick form
    <div key="1" className="relative w-full h-48 flex items-center justify-center">
      <motion.div initial={{ rotate: -8, x: -20 }} whileInView={{ rotate: -8, x: -20 }} className="absolute w-36 h-44 bg-white rounded-xl shadow-lg border border-slate-200 p-4">
        <div className="w-full h-3 bg-slate-200 rounded mb-2" /><div className="w-3/4 h-3 bg-slate-100 rounded mb-4" />
        <div className="space-y-2"><div className="w-full h-2 bg-slate-100 rounded" /><div className="w-full h-2 bg-slate-100 rounded" /><div className="w-2/3 h-2 bg-slate-100 rounded" /></div>
      </motion.div>
      <motion.div initial={{ rotate: 4, x: 20, y: 10 }} whileInView={{ rotate: 4, x: 20, y: 10 }} className="absolute w-36 h-44 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-xl border-2 border-indigo-200 p-4">
        <div className="w-full h-3 bg-indigo-200 rounded mb-2" /><div className="w-3/4 h-3 bg-indigo-100 rounded mb-4" />
        <div className="space-y-2"><div className="w-full h-2 bg-indigo-100 rounded" /><div className="w-full h-2 bg-indigo-100 rounded" /><div className="w-2/3 h-2 bg-indigo-100 rounded" /></div>
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
          <CheckCircle className="w-5 h-5 text-white" />
        </motion.div>
      </motion.div>
    </div>,
    // Step 2 - Q&A
    <div key="2" className="relative w-full h-48 flex items-center justify-center">
      <div className="space-y-3 w-56">
        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} viewport={{ once: true }} className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0" />
          <div className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-2 text-sm text-slate-700">{t('howItWorks.chatQuestion')}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} viewport={{ once: true }} className="flex justify-end">
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl rounded-tr-none px-4 py-2 text-sm text-white">{t('howItWorks.chatAnswer')}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: 1.0 }} viewport={{ once: true }} className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0" />
          <div className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-2 text-sm text-slate-700">{t('howItWorks.chatFollowUp')}</div>
        </motion.div>
      </div>
    </div>,
    // Step 3 - Download
    <div key="3" className="relative w-full h-48 flex items-center justify-center">
      <motion.div className="relative">
        <div className="w-40 h-48 bg-white rounded-xl shadow-xl border-2 border-green-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-green-600" />
            <span className="text-xs font-bold text-green-700">{t('howItWorks.formW9')}</span>
          </div>
          <div className="space-y-2"><div className="w-full h-2 bg-green-100 rounded" /><div className="w-full h-2 bg-green-100 rounded" /><div className="w-3/4 h-2 bg-green-100 rounded" /></div>
          <div className="mt-3 flex items-center gap-1">
            <div className="w-6 h-6 rounded border border-green-300 flex items-center justify-center"><CheckCircle className="w-4 h-4 text-green-500" /></div>
            <span className="text-xs text-green-600 font-medium">{t('success.verified')}</span>
          </div>
        </div>
        <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 2, repeat: Infinity }} className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-teal-500 to-green-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
          <Download className="w-3 h-3" /> {t('success.statusReady')}!
        </motion.div>
      </motion.div>
    </div>,
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
              <motion.div key={index} initial={{ y: 40, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.6, delay: 0.1 }} className={`flex flex-col ${isReversed ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12`}>
                <div className="flex-1 relative">
                  <MemphisShapes variant={(index + 1) as 1 | 2 | 3} />
                  <div className="bg-gradient-to-br from-slate-50 to-white rounded-3xl p-8 border border-slate-200 shadow-lg relative overflow-hidden">
                    {illustrations[index]}
                  </div>
                </div>
                <div className="flex-1 space-y-4">
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
