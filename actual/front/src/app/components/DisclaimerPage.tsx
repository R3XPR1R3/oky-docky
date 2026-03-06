import { motion } from 'motion/react';
import { FileText, ArrowLeft, Shield, AlertTriangle, Scale, Lock } from 'lucide-react';
import { Button } from './ui/button';
import { LanguageSelector } from './LanguageSelector';
import { useTranslation } from '../i18n/I18nContext';

interface DisclaimerPageProps {
  onBack: () => void;
}

const SECTION_ICONS = [Shield, AlertTriangle, Scale, Lock, Shield, Scale];

export function DisclaimerPage({ onBack }: DisclaimerPageProps) {
  const { t } = useTranslation();

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

      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <Scale className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{t('disclaimer.title')}</h1>
              <p className="text-sm text-slate-500">{t('disclaimer.lastUpdated')}</p>
            </div>
          </div>
        </motion.div>

        <div className="space-y-10">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-bold text-amber-800 mb-2">{t('disclaimer.importantNotice')}</h2>
                <p className="text-amber-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('disclaimer.importantNoticeText') }} />
              </div>
            </div>
          </motion.div>

          {[0, 1, 2, 3, 4, 5].map((sectionIndex) => {
            const sectionTitle = t(`disclaimer.sections.${sectionIndex}.title` as any);
            if (!sectionTitle || sectionTitle === `disclaimer.sections.${sectionIndex}.title`) return null;
            const Icon = SECTION_ICONS[sectionIndex] || Shield;

            return (
              <motion.div key={sectionIndex} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 + sectionIndex * 0.05 }}>
                <div className="flex items-center gap-2 mb-4">
                  <Icon className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-xl font-bold text-slate-800">{sectionTitle}</h2>
                </div>
                <div className="space-y-3 pl-7">
                  {[0, 1, 2, 3, 4].map((pi) => {
                    const paragraph = t(`disclaimer.sections.${sectionIndex}.paragraphs.${pi}` as any);
                    if (!paragraph || paragraph === `disclaimer.sections.${sectionIndex}.paragraphs.${pi}`) return null;
                    return <p key={pi} className="text-slate-600 leading-relaxed">{paragraph}</p>;
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-16 text-center text-sm text-slate-500 border-t border-slate-200 pt-8">
          <p>{t('disclaimer.contactLine')}</p>
          <p className="mt-2">{t('disclaimer.copyright')}</p>
        </motion.div>
      </div>
    </div>
  );
}
