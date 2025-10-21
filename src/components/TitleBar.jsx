import { Minus, Square, X } from 'lucide-react'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

export function TitleBar() {
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
    <div className="h-8 bg-card border-b border-border flex items-center justify-between px-4 select-none" style={{ WebkitAppRegion: 'drag' }}>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-primary"></div>
        <span className="text-xs font-medium">Software Launcher</span>
      </div>

      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={handleMinimize}
          className="w-8 h-8 flex items-center justify-center hover:bg-accent rounded transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-8 h-8 flex items-center justify-center hover:bg-accent rounded transition-colors"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground rounded transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
