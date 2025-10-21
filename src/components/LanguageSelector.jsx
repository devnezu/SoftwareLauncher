import { Globe } from 'lucide-react'
import { useTranslation } from '../i18n/LanguageContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { useState } from 'react'

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'pt-BR', name: 'Português', flag: '🇧🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
]

export function LanguageSelector() {
  const { language, setLanguage, t } = useTranslation()
  const [open, setOpen] = useState(false)

  const currentLang = languages.find(l => l.code === language) || languages[0]

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full justify-start gap-2"
      >
        <Globe className="w-4 h-4" />
        <span className="text-sm">{currentLang.flag} {currentLang.name}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Language / Idioma / 语言
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-2">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code)
                  setOpen(false)
                }}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  language === lang.code
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card hover:bg-accent border-border'
                }`}
              >
                <span className="text-2xl">{lang.flag}</span>
                <div className="flex-1 text-left">
                  <div className="font-medium">{lang.name}</div>
                  <div className={`text-xs ${
                    language === lang.code ? 'opacity-80' : 'text-muted-foreground'
                  }`}>
                    {t(`languages.${lang.code}`)}
                  </div>
                </div>
                {language === lang.code && (
                  <div className="w-2 h-2 rounded-full bg-current" />
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
