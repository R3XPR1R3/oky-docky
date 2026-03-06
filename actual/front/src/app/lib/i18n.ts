export type Language = 'en' | 'ru' | 'es' | 'ht' | 'pt-BR' | 'id';

const translations: Record<Language, Record<string, string>> = {
  en: {
    language: 'Language',
    how: 'How It Works',
    pricing: 'Pricing',
    getStarted: 'Get Started',
    trusted: 'Trusted by 500,000+ users',
    title: 'Fill Forms Like',
    accent: 'Chatting With a Friend',
    subtitle: "No more confusing paperwork. Answer simple questions and we'll handle the rest. Get your IRS forms completed in minutes.",
    getStartedFree: 'Get Started Free',
    seeHow: 'See How It Works',
    noCard: 'No credit card required • Free for personal use',
    footerTerms: 'Terms & Disclaimer'
  },
  ru: {
    language: 'Язык',
    how: 'Как это работает',
    pricing: 'Цены',
    getStarted: 'Начать',
    trusted: 'Нам доверяют 500 000+ пользователей',
    title: 'Заполняйте формы как',
    accent: 'в диалоге с другом',
    subtitle: 'Без сложной бумажной рутины. Ответьте на простые вопросы, а остальное мы сделаем за вас. Формы IRS за минуты.',
    getStartedFree: 'Начать бесплатно',
    seeHow: 'Смотреть как работает',
    noCard: 'Без карты • Бесплатно для личного использования',
    footerTerms: 'Условия и отказ от ответственности'
  },
  es: {
    language: 'Idioma',
    how: 'Cómo funciona',
    pricing: 'Precios',
    getStarted: 'Comenzar',
    trusted: 'Con la confianza de más de 500.000 usuarios',
    title: 'Completa formularios como',
    accent: 'si hablaras con un amigo',
    subtitle: 'Sin papeleo confuso. Responde preguntas simples y nosotros hacemos el resto. Completa formularios del IRS en minutos.',
    getStartedFree: 'Comenzar gratis',
    seeHow: 'Ver cómo funciona',
    noCard: 'Sin tarjeta • Gratis para uso personal',
    footerTerms: 'Términos y descargo'
  },
  ht: {
    language: 'Lang',
    how: 'Kijan sa mache',
    pricing: 'Pri',
    getStarted: 'Kòmanse',
    trusted: '500,000+ itilizatè fè nou konfyans',
    title: 'Ranpli fòm tankou',
    accent: 'w ap pale ak yon zanmi',
    subtitle: 'Pa gen papye konfizyon ankò. Reponn kestyon senp, n ap fè rès la. Ranpli fòm IRS an kèk minit.',
    getStartedFree: 'Kòmanse gratis',
    seeHow: 'Gade kijan sa mache',
    noCard: 'Pa bezwen kat kredi • Gratis pou itilizasyon pèsonèl',
    footerTerms: 'Tèm ak avètisman'
  },
  'pt-BR': {
    language: 'Idioma',
    how: 'Como funciona',
    pricing: 'Preços',
    getStarted: 'Começar',
    trusted: 'Mais de 500.000 usuários confiam',
    title: 'Preencha formulários como',
    accent: 'se estivesse conversando com um amigo',
    subtitle: 'Chega de papelada confusa. Responda perguntas simples e nós cuidamos do resto. Formulários do IRS em minutos.',
    getStartedFree: 'Começar grátis',
    seeHow: 'Veja como funciona',
    noCard: 'Sem cartão • Grátis para uso pessoal',
    footerTerms: 'Termos e aviso legal'
  },
  id: {
    language: 'Bahasa',
    how: 'Cara Kerja',
    pricing: 'Harga',
    getStarted: 'Mulai',
    trusted: 'Dipercaya 500.000+ pengguna',
    title: 'Isi Formulir Seperti',
    accent: 'Sedang Chat dengan Teman',
    subtitle: 'Tanpa dokumen yang membingungkan. Jawab pertanyaan sederhana dan kami urus sisanya. Formulir IRS selesai dalam hitungan menit.',
    getStartedFree: 'Mulai Gratis',
    seeHow: 'Lihat Cara Kerja',
    noCard: 'Tanpa kartu kredit • Gratis untuk penggunaan pribadi',
    footerTerms: 'Syarat & Disclaimer'
  }
};

export function t(lang: Language, key: string): string {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}
