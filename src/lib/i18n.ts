import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LOCALE } from '~/lib/locale'
import viVN from '~/locales/vi-VN.json'
import enUS from '~/locales/en-US.json'

export const LANG_KEY = 'giaoly_lang'

const savedLang =
  typeof localStorage !== 'undefined'
    ? (localStorage.getItem(LANG_KEY) ?? DEFAULT_LOCALE)
    : DEFAULT_LOCALE

i18n.use(initReactI18next).init({
  resources: {
    'vi-VN': { translation: viVN },
    'en-US': { translation: enUS },
  },
  lng: savedLang,
  fallbackLng: 'vi-VN',
  interpolation: { escapeValue: false },
})

export function setLanguage(lang: string) {
  localStorage.setItem(LANG_KEY, lang)
  void i18n.changeLanguage(lang)
}

export default i18n
