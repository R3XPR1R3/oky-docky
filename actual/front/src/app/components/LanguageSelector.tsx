import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslation } from '../i18n/I18nContext';

const LOCALE_META: Record<string, { flag: string; name: string }> = {
  en: { flag: '🇺🇸', name: 'English' },
  ru: { flag: '🇷🇺', name: 'Русский' },
  es: { flag: '🇪🇸', name: 'Español' },
  fr: { flag: '🇫🇷', name: 'Français' },
  it: { flag: '🇮🇹', name: 'Italiano' },
  ht: { flag: '🇭🇹', name: 'Kreyòl Ayisyen' },
  id: { flag: '🇮🇩', name: 'Bahasa Indonesia' },
};

export function LanguageSelector() {
  const { locale, setLocale, locales } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = LOCALE_META[locale] || { flag: '🌐', name: locale };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
          open
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm'
            : 'bg-white/60 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
        }`}
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="hidden sm:inline">{current.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 bg-white/95 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden z-[100] min-w-[200px] py-1.5"
          >
            {locales.map((loc) => {
              const meta = LOCALE_META[loc] || { flag: '🌐', name: loc };
              const isActive = loc === locale;
              return (
                <button
                  key={loc}
                  onClick={() => {
                    setLocale(loc);
                    setOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150
                    ${isActive
                      ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                    }
                  `}
                >
                  <span className="text-base leading-none w-6 text-center">{meta.flag}</span>
                  <span className="flex-1 text-left">{meta.name}</span>
                  {isActive && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
                      <Check className="w-4 h-4 text-indigo-600" />
                    </motion.div>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
