import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations } from './translations'

interface LanguageContextType {
  language: string
  setLanguage: (lang: string) => void
  t: (key: string, params?: Record<string, any>) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const STORAGE_KEY = 'app-language'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved || 'en'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language)
  }, [language])

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: (key: string, params?: Record<string, any>) => {
      const keys = key.split('.')
      let value: any = (translations as any)[language]

      for (const k of keys) {
        value = value?.[k]
      }

      // Se temos parâmetros, substitui placeholders como {count}
      if (params && typeof value === 'string') {
        return Object.keys(params).reduce((str, paramKey) => {
          return str.replace(new RegExp(`{${paramKey}}`, 'g'), String(params[paramKey]))
        }, value)
      }

      return value || key
    }
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useTranslation must be used within LanguageProvider')
  }
  return context
}
