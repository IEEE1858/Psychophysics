import { useCallback, useEffect, useMemo, useState } from 'react'
import en from '../locales/en'
import {
  DICTIONARIES,
  I18nContext,
  interpolate,
  isRightToLeft,
  normalizeLanguage,
  readInitialLanguage,
  STORAGE_KEY,
} from './i18n'

// Holds the active language for the app (issue #50). Kept in its own file so
// lib/i18n.js can export the hooks and tables without mixing components and plain
// exports in one module.
export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(readInitialLanguage)

  // Keep the document in sync so assistive technology announces the right language
  // and Hebrew lays out right-to-left.
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = isRightToLeft(language) ? 'rtl' : 'ltr'
  }, [language])

  const setLanguage = useCallback((next) => {
    const resolved = normalizeLanguage(next) ?? 'en'
    setLanguageState(resolved)
    localStorage.setItem(STORAGE_KEY, resolved)

    // Reflect the choice in the address bar without navigating, so the URL stays
    // copy-pasteable. English is the default and needs no parameter.
    const url = new URL(window.location.href)
    if (resolved === 'en') {
      url.searchParams.delete('lang')
    } else {
      url.searchParams.set('lang', resolved)
    }
    window.history.replaceState({}, '', url)
  }, [])

  const value = useMemo(() => {
    const dictionary = DICTIONARIES[language] ?? en

    function t(key, values) {
      const template = dictionary[key] ?? en[key]
      if (template == null) {
        // A key with no English either is a bug in our own call site, not a missing
        // translation. Surface it in development rather than rendering "undefined".
        if (import.meta.env.DEV) {
          console.warn(`[i18n] no string for key: ${key}`)
        }
        return key
      }
      return interpolate(template, values)
    }

    return { language, setLanguage, t, isRtl: isRightToLeft(language) }
  }, [language, setLanguage])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export default I18nProvider
