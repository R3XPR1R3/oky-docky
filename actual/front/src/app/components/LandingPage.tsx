import { motion } from 'motion/react';
import { FileText, Sparkles, Shield, Clock, CheckCircle, ArrowRight, Zap, Settings2 } from 'lucide-react';
import { Button } from './ui/button';
import { LanguageSelector } from './LanguageSelector';
import { useTranslation } from '../i18n/I18nContext';

interface LandingPageProps {
  onGetStarted: () => void;
  onHowItWorks: () => void;
  onPricing: () => void;
  onDisclaimer: () => void;
  onBuilder?: () => void;
}

const FEATURE_ICONS = [Sparkles, Clock, Shield, CheckCircle];
const FEATURE_KEYS = ['simpleQuestions', 'saveTime', 'secure', 'instant'] as const;

export function LandingPage({ onGetStarted, onHowItWorks, onPricing, onDisclaimer, onBuilder }: LandingPageProps) {
  const { t } = useTranslation();

  const features = FEATURE_KEYS.map((key, i) => ({
    icon: FEATURE_ICONS[i],
    title: t(`landing.features.${key}.title`),
    description: t(`landing.features.${key}.description`),
  }));

  return (
    <div className="min-h-screen">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }} className="border-b border-white/20 backdrop-blur-sm bg-white/40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{t('app.name')}</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-sm" onClick={onHowItWorks}>{t('nav.howItWorks')}</Button>
            <Button variant="ghost" className="text-sm" onClick={onPricing}>{t('nav.pricing')}</Button>
            {onBuilder && (
              <Button variant="ghost" className="text-sm gap-1" onClick={onBuilder}>
                <Settings2 className="w-4 h-4" /> Builder
              </Button>
            )}
            <LanguageSelector />
            <Button variant="outline" className="text-sm" onClick={onGetStarted}>{t('nav.getStarted')}</Button>
          </div>
        </div>
      </motion.header>

      <div className="container mx-auto px-4 pt-20 pb-32">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }} className="text-center max-w-4xl mx-auto">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 text-indigo-700 mb-6">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">{t('landing.badge')}</span>
          </motion.div>

          <h1 className="text-6xl font-bold mb-6 leading-tight">
            {t('landing.heroTitle')}{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">{t('landing.heroTitleHighlight')}</span>
          </h1>

          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">{t('landing.heroDescription')}</p>

          <div className="flex items-center justify-center gap-4">
            <Button size="lg" onClick={onGetStarted} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-300">
              {t('landing.getStartedFree')}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="px-8 py-6 text-lg rounded-xl border-2" onClick={onHowItWorks}>{t('landing.seeHowItWorks')}</Button>
          </div>

          <p className="text-sm text-slate-500 mt-4">{t('landing.noCreditCard')}</p>
        </motion.div>

        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, delay: 0.5 }} className="max-w-5xl mx-auto mt-16">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl blur-3xl opacity-20"></div>
            <div className="relative bg-white rounded-2xl shadow-2xl p-8 border border-slate-200">
              <div className="flex items-center gap-2 mb-6">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0"><Sparkles className="w-5 h-5 text-white" /></div>
                  <div className="flex-1"><div className="bg-slate-100 rounded-2xl rounded-tl-none p-4"><p className="text-slate-700">{t('landing.chatQuestion')}</p></div></div>
                </div>
                <div className="flex items-start gap-4 justify-end">
                  <div className="flex-1 flex justify-end"><div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl rounded-tr-none p-4 max-w-md"><p className="text-white">{t('landing.chatAnswer')}</p></div></div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0"><Sparkles className="w-5 h-5 text-white" /></div>
                  <div className="flex-1"><div className="bg-slate-100 rounded-2xl rounded-tl-none p-4"><p className="text-slate-700">{t('landing.chatFollowUp')}</p></div></div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="container mx-auto px-4 py-24">
        <motion.div initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">{t('landing.whyChoose')}</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">{t('landing.whyChooseDescription')}</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div key={index} initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.1 }} whileHover={{ y: -5 }} className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-6"><feature.icon className="w-7 h-7 text-indigo-600" /></div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="container mx-auto px-4 py-24">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-12 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30"></div>
          <div className="relative">
            <h2 className="text-4xl font-bold mb-4">{t('landing.ctaTitle')}</h2>
            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">{t('landing.ctaDescription')}</p>
            <Button size="lg" onClick={onGetStarted} className="bg-white text-indigo-600 hover:bg-slate-50 px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
              {t('landing.ctaButton')}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </motion.div>

      <footer className="border-t border-slate-200 bg-white/60 backdrop-blur-sm py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
            <p>{t('landing.copyright')}</p>
            <div className="flex items-center gap-6">
              <button onClick={onHowItWorks} className="hover:text-indigo-600 transition-colors">{t('nav.howItWorks')}</button>
              <button onClick={onPricing} className="hover:text-indigo-600 transition-colors">{t('nav.pricing')}</button>
              <button onClick={onDisclaimer} className="hover:text-indigo-600 transition-colors">{t('nav.termsDisclaimer')}</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
