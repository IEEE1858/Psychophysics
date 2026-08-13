import { createContext, createElement, Fragment, useContext } from 'react'
import en from '../locales/en'
import deDE from '../locales/de-DE'
import esES from '../locales/es-ES'
import frFR from '../locales/fr-FR'
import heIL from '../locales/he-IL'
import hiIN from '../locales/hi-IN'
import itIT from '../locales/it-IT'
import jaJP from '../locales/ja-JP'
import koKR from '../locales/ko-KR'
import ruRU from '../locales/ru-RU'
import zhCN from '../locales/zh-CN'
import ukUA from '../locales/uk-UA'
import zhTW from '../locales/zh-TW'

// Translation support (issue #50). The study recruits internationally, so every
// participant-facing string is looked up by key rather than written inline.
//
// Two deliberate choices:
//
//   1. Lookup falls back to English per key, not per language. A missing or
//      not-yet-translated string renders in English instead of showing a raw key,
//      so the study is never broken by an incomplete dictionary.
//   2. The language lives in the URL (?lang=). Sharing a link therefore shares the
//      language, which is what the issue asks for, and it makes a participant's
//      language reproducible when we look at their responses later.
//
// The provider component lives in I18nProvider.jsx; this module holds only the
// data and hooks, so fast refresh is not defeated by mixing the two.

export const STORAGE_KEY = 'lang'

// Native name first, English name in parentheses, per the issue. Note that the
// issue's own example swapped the two Chinese labels, listing 中文简体 as
// "Traditional Chinese": 中文简体 is Simplified and 繁體中文 is Traditional, as set here.
export const LANGUAGES = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'zh-CN', native: '中文简体', english: 'Simplified Chinese' },
  { code: 'zh-TW', native: '繁體中文', english: 'Traditional Chinese' },
  { code: 'fr-FR', native: 'Français', english: 'French' },
  { code: 'de-DE', native: 'Deutsch', english: 'German' },
  { code: 'he-IL', native: 'עברית', english: 'Hebrew', dir: 'rtl' },
  { code: 'hi-IN', native: 'हिन्दी', english: 'Hindi' },
  { code: 'ja-JP', native: '日本語', english: 'Japanese' },
  { code: 'ko-KR', native: '한국어', english: 'Korean' },
  { code: 'es-ES', native: 'Español', english: 'Spanish' },
  { code: 'it-IT', native: 'Italiano', english: 'Italian' },
  { code: 'ru-RU', native: 'Русский', english: 'Russian' },
  { code: 'uk-UA', native: 'Українська', english: 'Ukrainian' },
]

export const DICTIONARIES = {
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'fr-FR': frFR,
  'de-DE': deDE,
  'he-IL': heIL,
  'hi-IN': hiIN,
  'ja-JP': jaJP,
  'ko-KR': koKR,
  'es-ES': esES,
  'it-IT': itIT,
  'ru-RU': ruRU,
  'uk-UA': ukUA,
}

export function languageLabel(code) {
  const language = LANGUAGES.find((entry) => entry.code === code)
  if (!language) {
    return code
  }
  return language.code === 'en' ? language.native : `${language.native} (${language.english})`
}

export function isRightToLeft(code) {
  return LANGUAGES.find((entry) => entry.code === code)?.dir === 'rtl'
}

// Resolves anything a browser or a shared link might carry onto one of the codes we
// actually ship. Browsers send plenty of tags we do not list verbatim — "fr", "fr-CA",
// "es-MX", "de-AT", "zh-Hans" — and all of them should still find their language
// rather than silently falling back to English.
export function normalizeLanguage(value) {
  if (!value) {
    return null
  }

  const lower = String(value).trim().toLowerCase().replace('_', '-')
  if (!lower) {
    return null
  }

  const exact = LANGUAGES.find((entry) => entry.code.toLowerCase() === lower)
  if (exact) {
    return exact.code
  }

  // Chinese is chosen by script rather than country: Taiwan, Hong Kong and Macau are
  // Traditional, the mainland and Singapore Simplified, and a bare "zh" is
  // conventionally Simplified. "zh-Hant"/"zh-Hans" are matched here too.
  if (lower.startsWith('zh')) {
    return /hant|tw|hk|mo/.test(lower) ? 'zh-TW' : 'zh-CN'
  }

  // Hebrew's ISO code changed from "iw" to "he"; some browsers still send the old one.
  const base = lower.split('-')[0] === 'iw' ? 'he' : lower.split('-')[0]

  // Any region falls back to the one we ship for that language, so "es-MX" gets
  // Spanish rather than nothing.
  return LANGUAGES.find((entry) => entry.code.toLowerCase().split('-')[0] === base)?.code ?? null
}

export function readInitialLanguage() {
  if (typeof window === 'undefined') {
    return 'en'
  }

  // A shared link wins over a stored preference: someone following a Spanish link
  // should see Spanish even if they once chose French here.
  const fromUrl = normalizeLanguage(new URLSearchParams(window.location.search).get('lang'))
  if (fromUrl) {
    return fromUrl
  }

  const stored = normalizeLanguage(localStorage.getItem(STORAGE_KEY))
  if (stored) {
    return stored
  }

  for (const candidate of navigator.languages ?? [navigator.language]) {
    const resolved = normalizeLanguage(candidate)
    if (resolved) {
      return resolved
    }
  }

  return 'en'
}

// Fill {name} placeholders. Keeps the dictionaries free of string concatenation,
// which would otherwise force translators into English word order.
export function interpolate(template, values) {
  if (!values) {
    return template
  }
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  )
}

export const I18nContext = createContext(null)

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used inside an I18nProvider')
  }
  return context
}

// Convenience for the common case of only needing the lookup function.
export function useT() {
  return useI18n().t
}

// Rich lookup: same {name} placeholders, but the substitutions are React nodes
// rather than text, so a sentence containing a link stays a single translatable
// string instead of being split into fragments around the markup. Splitting is what
// forces translators into English word order, and several languages here put the
// verb or the qualifier somewhere English does not.
export function useTx() {
  const { t } = useI18n()

  return function tx(key, nodes) {
    const template = t(key)
    if (!nodes) {
      return template
    }

    return template.split(/(\{\w+\})/g).map((part, index) => {
      const match = /^\{(\w+)\}$/.exec(part)
      if (match && Object.prototype.hasOwnProperty.call(nodes, match[1])) {
        return createElement(Fragment, { key: index }, nodes[match[1]])
      }
      return part
    })
  }
}

// Append the active language to a url we are about to hand to someone else, so a
// shared link opens in the language the sharer was reading (issue #50).
export function withLanguageParam(url, language) {
  if (!language || language === 'en') {
    return url
  }
  const parsed = new URL(url)
  parsed.searchParams.set('lang', language)
  return parsed.toString()
}
