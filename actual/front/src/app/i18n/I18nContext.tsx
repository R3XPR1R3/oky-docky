import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

const API_URL = '';
const STORAGE_KEY = 'oky-docky-locale';

interface I18nContextValue {
  locale: string;
  setLocale: (locale: string) => void;
  locales: string[];
  t: (key: string, params?: Record<string, string>) => string;
  ready: boolean;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  locales: ['en'],
  t: (k) => k,
  ready: false,
});

export function useTranslation() {
  return useContext(I18nContext);
}

/**
 * Resolve a dot-separated key from a nested object.
 * e.g. resolve("landing.features.saveTime.title", translations)
 */
function resolve(obj: any, path: string): string | undefined {
  let cur = obj;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  if (typeof cur === 'string') return cur;
  return undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) || 'en',
  );
  const [locales, setLocales] = useState<string[]>(['en']);
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const [ready, setReady] = useState(false);

  // Load available locales on mount
  useEffect(() => {
    fetch(`${API_URL}/api/meta`)
      .then((r) => r.json())
      .then((data) => {
        if (data.locales?.length) setLocales(data.locales);
      })
      .catch(() => {});
  }, []);

  // Load translations when locale changes
  useEffect(() => {
    setReady(false);
    fetch(`${API_URL}/api/i18n/${locale}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load translations');
        return r.json();
      })
      .then((data) => {
        setTranslations(data);
        setReady(true);
      })
      .catch(() => {
        // Fallback: try English
        if (locale !== 'en') {
          fetch(`${API_URL}/api/i18n/en`)
            .then((r) => r.json())
            .then((data) => {
              setTranslations(data);
              setReady(true);
            })
            .catch(() => setReady(true));
        } else {
          setReady(true);
        }
      });
  }, [locale]);

  const setLocale = useCallback((newLocale: string) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      let value = resolve(translations, key);
      if (value === undefined) return key;

      // Replace {param} placeholders
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value!.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
        }
      }
      return value!;
    },
    [translations],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, locales, t, ready }}>
      {children}
    </I18nContext.Provider>
  );
}
