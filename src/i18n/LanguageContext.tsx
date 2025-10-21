import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations } from './translations'

interface LanguageContextType {
  language: string
  setLanguage: (language: string) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const STORAGE_KEY = 'app-language'

interface LanguageProviderProps {
  children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguage] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved || 'en'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language)
  }, [language])

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: (key: string): string => {
      const keys = key.split('.')
      let value: any = translations[language as keyof typeof translations]

      for (const k of keys) {
        value = value?.[k]
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

export function useTranslation(): LanguageContextType {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useTranslation must be used within LanguageProvider')
  }
  return context
}
