import { Settings as SettingsIcon, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from '../i18n/LanguageContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'gemini-api-key'

export function Settings({ compact = false }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)

  // Carrega a API key do localStorage ao montar o componente
  useEffect(() => {
    const loadApiKey = async () => {
      try {
        const savedKey = localStorage.getItem(STORAGE_KEY)
        if (savedKey) {
          setApiKey(savedKey)
          setHasApiKey(true)
          // Notifica o processo Electron sobre a API key
          if (window.electron) {
            await window.electron.invoke('set-gemini-api-key', savedKey)
          }
        }
      } catch (error) {
        console.error('Error loading API key:', error)
      }
    }
    loadApiKey()
  }, [])

  const handleSave = async () => {
    try {
      if (apiKey.trim()) {
        // Salva no localStorage
        localStorage.setItem(STORAGE_KEY, apiKey.trim())
        setHasApiKey(true)

        // Notifica o processo Electron sobre a nova API key
        if (window.electron) {
          await window.electron.invoke('set-gemini-api-key', apiKey.trim())
        }

        setOpen(false)
      } else {
        // Remove se estiver vazio
        localStorage.removeItem(STORAGE_KEY)
        setHasApiKey(false)

        if (window.electron) {
          await window.electron.invoke('set-gemini-api-key', null)
        }
      }
    } catch (error) {
      console.error('Error saving API key:', error)
    }
  }

  const handleClear = async () => {
    try {
      setApiKey('')
      localStorage.removeItem(STORAGE_KEY)
      setHasApiKey(false)

      if (window.electron) {
        await window.electron.invoke('set-gemini-api-key', null)
      }
    } catch (error) {
      console.error('Error clearing API key:', error)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className={`rounded-lg ${hasApiKey ? 'text-green-500' : ''}`}
        title={t('settings.title')}
      >
        <SettingsIcon className="w-4 h-4" strokeWidth={1.5} />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" strokeWidth={1.5} />
              {t('settings.title')}
            </DialogTitle>
            <DialogDescription>
              {t('settings.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gemini-api-key">
                {t('settings.gemini.apiKey')}
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="gemini-api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={t('settings.gemini.placeholder')}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('settings.gemini.help')}
              </p>
            </div>

            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                onClick={handleClear}
                disabled={!hasApiKey && !apiKey}
              >
                {t('settings.clear')}
              </Button>
              <Button onClick={handleSave}>
                {t('settings.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
