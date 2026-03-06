import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Check } from 'lucide-react';
import { useTranslation } from '../i18n/I18nContext';

const LOCALE_META: Record<string, { flag: string; name: string }> = {
  en: { flag: 'EN', name: 'English' },
  ru: { flag: 'RU', name: 'Русский' },
};

export function LanguageSelector() {
  const { locale, setLocale, locales } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = LOCALE_META[locale] || { flag: locale.toUpperCase(), name: locale };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
      >
        <Globe className="w-4 h-4" />
        <span>{current.flag}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50 min-w-[160px]"
          >
            {locales.map((loc) => {
              const meta = LOCALE_META[loc] || { flag: loc.toUpperCase(), name: loc };
              const isActive = loc === locale;
              return (
                <button
                  key={loc}
                  onClick={() => {
                    setLocale(loc);
                    setOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                    ${isActive
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                    }
                  `}
                >
                  <span className="font-mono text-xs w-6">{meta.flag}</span>
                  <span className="flex-1 text-left">{meta.name}</span>
                  {isActive && <Check className="w-4 h-4 text-indigo-600" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
