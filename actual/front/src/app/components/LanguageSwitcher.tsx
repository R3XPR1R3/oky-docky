import type { Language } from '../lib/i18n';
import { t } from '../lib/i18n';

interface Props {
  language: Language;
  onChange: (next: Language) => void;
}

const options: Language[] = ['en', 'ru', 'es', 'ht', 'pt-BR', 'id'];

export function LanguageSwitcher({ language, onChange }: Props) {
  return (
    <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow">
      <span className="text-xs text-slate-500">{t(language, 'language')}:</span>
      {options.map((code) => (
        <button
          key={code}
          onClick={() => onChange(code)}
          className={`rounded px-2 py-1 text-xs ${language === code ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
