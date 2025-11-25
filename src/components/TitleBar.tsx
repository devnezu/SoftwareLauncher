import { Minimize2, Maximize2, X } from 'lucide-react'
import { useTranslation } from '../i18n/LanguageContext'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

export function TitleBar() {
  const { t } = useTranslation()

  const handleMinimize = () => {
    if (ipcRenderer) {
      ipcRenderer.invoke('window-minimize')
    }
  }

  const handleMaximize = () => {
    if (ipcRenderer) {
      ipcRenderer.invoke('window-maximize')
    }
  }

  const handleClose = () => {
    if (ipcRenderer) {
      ipcRenderer.invoke('window-close')
    }
  }

  return (
    <div className="h-9 bg-card border-b border-border flex items-center justify-between px-4 select-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-light tracking-wide">{t('titleBar.title')}</span>
      </div>

      <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          className="w-10 h-7 flex items-center justify-center hover:bg-accent/50 transition-all duration-150 group"
          title="Minimizar"
        >
          <Minimize2 className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
        </button>
        <button
          onClick={handleMaximize}
          className="w-10 h-7 flex items-center justify-center hover:bg-accent/50 transition-all duration-150 group"
          title="Maximizar/Restaurar"
        >
          <Maximize2 className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
        </button>
        <button
          onClick={handleClose}
          className="w-10 h-7 flex items-center justify-center hover:bg-destructive/90 hover:text-white transition-all duration-150 group"
          title="Fechar"
        >
          <X className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
