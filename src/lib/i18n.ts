import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE } from '~/lib/locale'
import vi from '~/locales/vi.json'
import en from '~/locales/en.json'

export const LANG_KEY = 'giaoly_lang'

const savedLang =
  typeof localStorage !== 'undefined'
    ? (localStorage.getItem(LANG_KEY) ?? DEFAULT_LANGUAGE)
    : DEFAULT_LANGUAGE

i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
})

export function setLanguage(lang: string) {
  localStorage.setItem(LANG_KEY, lang)
  void i18n.changeLanguage(lang)
}

export default i18n
