import { useState, useEffect } from 'react'
import { HeartPulse, CheckCircle, XCircle, AlertCircle, RotateCw, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { Button } from './ui/button'
import { useTranslation } from '../i18n/LanguageContext'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

interface HealthStatus {
  taskName: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  failureCount: number
  maxRetries: number
  lastCheck: number
  url: string
  responseTime?: number
}

interface HealthEvent {
  type: 'health-check-failed' | 'health-recovered' | 'auto-restart'
  projectName: string
  taskName: string
  message: string
  timestamp: number
  responseTime?: number
}

interface HealthCheckPanelProps {
  projectId: string
  projectName: string
  isRunning: boolean
}

export function HealthCheckPanel({ projectId, projectName, isRunning }: HealthCheckPanelProps) {
  const { t } = useTranslation()
  const [healthStatuses, setHealthStatuses] = useState<HealthStatus[]>([])
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>([])
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('healthCheckCollapsed')
    return saved ? JSON.parse(saved) : false
  })

  // Persistir estado collapsed
  useEffect(() => {
    localStorage.setItem('healthCheckCollapsed', JSON.stringify(collapsed))
  }, [collapsed])

  useEffect(() => {
    if (!ipcRenderer || !isRunning) return

    // Carregar status inicial
    ipcRenderer.invoke('get-health-status', projectId).then((statuses: HealthStatus[]) => {
      setHealthStatuses(statuses)
    })

    // Carregar histórico inicial
    ipcRenderer.invoke('get-health-history', projectId).then((events: HealthEvent[]) => {
      setHealthEvents(events)
    })

    // Listener para atualizações de status
    const handleStatusUpdate = (event: any, data: HealthStatus & { projectId: string }) => {
      if (data.projectId === projectId) {
        setHealthStatuses(prev => {
          const index = prev.findIndex(s => s.taskName === data.taskName)
          if (index >= 0) {
            const newStatuses = [...prev]
            newStatuses[index] = {
              taskName: data.taskName,
              status: data.status,
              failureCount: data.failureCount,
              maxRetries: data.maxRetries,
              lastCheck: data.lastCheck,
              url: data.url || newStatuses[index].url,
              responseTime: data.responseTime
            }
            return newStatuses
          } else {
            return [...prev, {
              taskName: data.taskName,
              status: data.status,
              failureCount: data.failureCount,
              maxRetries: data.maxRetries,
              lastCheck: data.lastCheck,
              url: data.url || '',
              responseTime: data.responseTime
            }]
          }
        })
      }
    }

    // Listener para eventos
    const handleEvent = (event: any, data: HealthEvent) => {
      if (data.projectName === projectName) {
        setHealthEvents(prev => {
          const newEvents = [...prev, data]
          // Manter apenas últimos 20 eventos
          if (newEvents.length > 20) {
            return newEvents.slice(-20)
          }
          return newEvents
        })
      }
    }

    ipcRenderer.on('health-check-status', handleStatusUpdate)
    ipcRenderer.on('health-check-event', handleEvent)

    return () => {
      ipcRenderer.removeListener('health-check-status', handleStatusUpdate)
      ipcRenderer.removeListener('health-check-event', handleEvent)
    }
  }, [projectId, projectName, isRunning])

  // Limpar quando parar
  useEffect(() => {
    if (!isRunning) {
      setHealthStatuses([])
      setHealthEvents([])
    }
  }, [isRunning])

  const handleRestart = async (taskName: string) => {
    if (!ipcRenderer) return
    const result = await ipcRenderer.invoke('restart-task', projectId, taskName)
    if (!result.success) {
      console.error('Erro ao reiniciar task:', result.error)
    }
  }

  // Não mostrar se não há health checks configurados
  if (!isRunning || healthStatuses.length === 0) {
    return null
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'degraded':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />
      case 'unhealthy':
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return <HeartPulse className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'border-green-500/30 bg-green-500/10'
      case 'degraded':
        return 'border-yellow-500/30 bg-yellow-500/10'
      case 'unhealthy':
        return 'border-red-500/30 bg-red-500/10'
      default:
        return 'border-border bg-card'
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const getTimeSince = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s atrás`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m atrás`
    const hours = Math.floor(minutes / 60)
    return `${hours}h atrás`
  }

  return (
    <div className="border-b border-border">
      {/* Header */}
      <div className="p-6 pb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4" />
          <h3 className="text-sm font-semibold">Health Checks</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="h-7 w-7 p-0"
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </Button>
      </div>

      {!collapsed && (
        <div className="px-6 pb-6 space-y-4">
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {healthStatuses.map((healthStatus, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${getStatusColor(healthStatus.status)}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(healthStatus.status)}
                    <div>
                      <div className="font-medium text-sm">{healthStatus.taskName}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {healthStatus.url}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRestart(healthStatus.taskName)}
                    className="h-7 w-7 p-0"
                    title="Reiniciar task"
                  >
                    <RotateCw className="w-3 h-3" />
                  </Button>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <span className={`ml-1 font-medium ${
                        healthStatus.status === 'healthy' ? 'text-green-400' :
                        healthStatus.status === 'degraded' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {healthStatus.status === 'healthy' ? 'Saudável' :
                         healthStatus.status === 'degraded' ? 'Degradado' :
                         'Inativo'}
                      </span>
                    </div>
                    {healthStatus.status !== 'healthy' && (
                      <div>
                        <span className="text-muted-foreground">Falhas:</span>
                        <span className="ml-1 font-medium">{healthStatus.failureCount}/{healthStatus.maxRetries}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {getTimeSince(healthStatus.lastCheck)}
                  </div>
                </div>

                {healthStatus.responseTime && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Tempo de resposta: {healthStatus.responseTime}ms
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Histórico de Eventos */}
          {healthEvents.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Histórico de Eventos</h4>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {healthEvents.slice().reverse().map((event, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded text-xs border ${
                      event.type === 'health-recovered' ? 'bg-green-500/5 border-green-500/20' :
                      event.type === 'auto-restart' ? 'bg-blue-500/5 border-blue-500/20' :
                      'bg-red-500/5 border-red-500/20'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium">{event.taskName}</span>
                        <span className="text-muted-foreground ml-2">{event.message}</span>
                      </div>
                      <span className="text-muted-foreground text-[10px] whitespace-nowrap">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
