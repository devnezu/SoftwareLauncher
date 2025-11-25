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
  { code: 'en', name: 'English', flagCode: 'us' },
  { code: 'pt-BR', name: 'Português', flagCode: 'br' },
  { code: 'es', name: 'Español', flagCode: 'es' },
  { code: 'fr', name: 'Français', flagCode: 'fr' },
  { code: 'zh', name: '中文', flagCode: 'cn' },
]

function FlagIcon({ code, className = "" }: { code: string; className?: string }) {
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      alt={`${code} flag`}
      className={`inline-block rounded ${className}`}
      style={{ width: '24px', height: 'auto' }}
    />
  )
}

export function LanguageSelector({ compact = false, collapsed = false }) {
  const { language, setLanguage, t } = useTranslation()
  const [open, setOpen] = useState(false)

  const currentLang = languages.find(l => l.code === language) || languages[0]

  if (compact) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          className="rounded-lg"
          title={currentLang.name}
        >
          <FlagIcon code={currentLang.flagCode} />
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-normal">
                <Globe className="w-5 h-5" strokeWidth={1.5} />
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
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 hover:scale-[1.02] ${
                    language === lang.code
                      ? 'bg-primary text-primary-foreground border-primary shadow-lg'
                      : 'bg-card hover:bg-accent border-border'
                  }`}
                >
                  <FlagIcon code={lang.flagCode} className="w-8" />
                  <div className="flex-1 text-left">
                    <div className="font-normal">{lang.name}</div>
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

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full justify-start gap-2"
      >
        <Globe className="w-4 h-4" strokeWidth={1.5} />
        <FlagIcon code={currentLang.flagCode} />
        <span className="text-sm font-light">{currentLang.name}</span>
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
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 hover:scale-[1.02] ${
                  language === lang.code
                    ? 'bg-primary text-primary-foreground border-primary shadow-lg'
                    : 'bg-card hover:bg-accent border-border'
                }`}
              >
                <FlagIcon code={lang.flagCode} className="w-8" />
                <div className="flex-1 text-left">
                  <div className="font-normal">{lang.name}</div>
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
