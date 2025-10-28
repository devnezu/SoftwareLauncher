import { useState, useEffect, useMemo, memo } from 'react'
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { Activity, Cpu, HardDrive, Clock, AlertTriangle, ChevronDown, ChevronUp, Pause, Play, RotateCcw, TrendingUp, Circle, Calendar, Search } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useTranslation } from '../i18n/LanguageContext'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

interface PerformanceMetrics {
  projectId: string
  projectName: string
  timestamp: number
  uptime: number
  cpu: string
  memory: string
  processCount: number
  processes: Array<{
    pid: number
    cpu: string
    memory: string
    elapsed: number
  }>
}

interface PerformanceAlert {
  type: 'cpu' | 'memory'
  level: 'warning' | 'critical'
  message: string
  projectId: string
  projectName: string
}

interface PerformancePanelProps {
  projectId: string
  projectName: string
  isRunning: boolean
}

export const PerformancePanel = memo(function PerformancePanel({ projectId, projectName, isRunning }: PerformancePanelProps) {
  const { t } = useTranslation()
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics | null>(null)
  const [history, setHistory] = useState<PerformanceMetrics[]>([])
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('metricsCollapsed')
    return saved ? JSON.parse(saved) : false
  })
  const [isPaused, setIsPaused] = useState(false)
  const [pausedHistory, setPausedHistory] = useState<PerformanceMetrics[]>([])
  const [pausedMetrics, setPausedMetrics] = useState<PerformanceMetrics | null>(null)
  const [processesCollapsed, setProcessesCollapsed] = useState(true)
  const [availablePeriods, setAvailablePeriods] = useState<Array<{year: number, month: number, label: string}>>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historicalData, setHistoricalData] = useState<PerformanceMetrics[]>([])
  const [dateFilterStart, setDateFilterStart] = useState('')
  const [dateFilterEnd, setDateFilterEnd] = useState('')
  const [showDateFilter, setShowDateFilter] = useState(false)

  // Formatar uptime - Moved before early returns
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  // Função para carregar períodos disponíveis
  const loadAvailablePeriods = async () => {
    if (!ipcRenderer) return
    const periods = await ipcRenderer.invoke('get-available-periods', projectId)
    setAvailablePeriods(periods)
  }

  // Função para carregar histórico de um período
  const loadHistoricalData = async () => {
    if (!ipcRenderer || !dateFilterStart || !dateFilterEnd) return

    setIsLoadingHistory(true)
    try {
      const start = new Date(dateFilterStart)
      const end = new Date(dateFilterEnd)
      end.setHours(23, 59, 59, 999) // Final do dia

      const data = await ipcRenderer.invoke('load-performance-history', projectId, start.toISOString(), end.toISOString())
      setHistoricalData(data)
      setIsPaused(true)
      setPausedHistory(data)
      if (data.length > 0) {
        setPausedMetrics(data[data.length - 1])
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Formatar dados para o gráfico (otimizado com useMemo) - Moved before early returns
  const chartData = useMemo(() => {
    const dataToUse = historicalData.length > 0 ? historicalData : (isPaused ? pausedHistory : history)

    // Se houver muitos pontos (> 500), fazer amostragem
    let sampledData = dataToUse
    if (dataToUse.length > 500) {
      const step = Math.ceil(dataToUse.length / 500)
      sampledData = dataToUse.filter((_, index) => index % step === 0)
    }

    return sampledData.map(m => ({
      time: new Date(m.timestamp).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      cpu: parseFloat(m.cpu),
      memory: parseFloat(m.memory),
      uptime: m.uptime
    }))
  }, [history, isPaused, pausedHistory, historicalData])

  // Métricas a exibir (pausadas ou atuais)
  const displayMetrics = isPaused ? pausedMetrics : currentMetrics

  // Função para pausar/resumir
  const togglePause = () => {
    if (!isPaused) {
      // Pausar: salvar estado atual
      setPausedHistory([...history])
      setPausedMetrics(currentMetrics)
    }
    setIsPaused(!isPaused)
  }

  // Função para resetar (voltar ao tempo real)
  const resetToLive = () => {
    setIsPaused(false)
    setPausedHistory([])
    setPausedMetrics(null)
    setHistoricalData([])
    setDateFilterStart('')
    setDateFilterEnd('')
    setShowDateFilter(false)
  }

  // Persistir estado collapsed
  useEffect(() => {
    localStorage.setItem('metricsCollapsed', JSON.stringify(collapsed))
  }, [collapsed])

  // Carregar períodos disponíveis quando o painel é aberto
  useEffect(() => {
    if (!collapsed && isRunning) {
      loadAvailablePeriods()
    }
  }, [collapsed, isRunning, projectId])

  useEffect(() => {
    if (!ipcRenderer || !isRunning) return

    // Handler para receber métricas em tempo real (otimizado)
    const handleMetrics = (event: any, metrics: PerformanceMetrics) => {
      if (metrics.projectId === projectId) {
        setCurrentMetrics(metrics)

        // Otimização: só atualizar histórico a cada 2 métricas (reduz re-renders)
        setHistory(prev => {
          const newHistory = [...prev, metrics]
          // Manter apenas últimos 30 pontos (reduzido de 60 para melhor performance)
          if (newHistory.length > 30) {
            return newHistory.slice(-30)
          }
          return newHistory
        })
      }
    }

    // Handler para receber alertas
    const handleAlert = (event: any, alert: PerformanceAlert) => {
      if (alert.projectId === projectId) {
        setAlerts(prev => {
          const newAlerts = [...prev, { ...alert, id: Date.now() }]
          // Manter apenas últimos 5 alertas
          if (newAlerts.length > 5) {
            return newAlerts.slice(-5)
          }
          return newAlerts
        })

        // Remover alerta após 10 segundos
        setTimeout(() => {
          setAlerts(prev => prev.filter(a => a !== alert))
        }, 10000)
      }
    }

    ipcRenderer.on('performance-metrics', handleMetrics)
    ipcRenderer.on('performance-alert', handleAlert)

    // Carregar histórico inicial
    ipcRenderer.invoke('get-performance-history', projectId).then((historyData: PerformanceMetrics[]) => {
      if (historyData && historyData.length > 0) {
        setHistory(historyData)
        setCurrentMetrics(historyData[historyData.length - 1])
      }
    })

    return () => {
      ipcRenderer.removeListener('performance-metrics', handleMetrics)
      ipcRenderer.removeListener('performance-alert', handleAlert)
    }
  }, [projectId, isRunning])

  // Limpar dados quando projeto para
  useEffect(() => {
    if (!isRunning) {
      setCurrentMetrics(null)
      setHistory([])
      setAlerts([])
    }
  }, [isRunning])

  if (!isRunning) {
    return (
      <div className="p-6 border-b border-border">
        <div className="text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <TrendingUp className="w-4 h-4" />
          {t('performance.notRunning') || 'Execute o projeto para ver métricas de performance'}
        </div>
      </div>
    )
  }

  if (!currentMetrics && !isPaused) {
    return (
      <div className="p-6 border-b border-border">
        <div className="text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Activity className="w-4 h-4 animate-pulse" />
          {t('performance.loading') || 'Carregando métricas...'}
        </div>
      </div>
    )
  }

  if (!displayMetrics) {
    return (
      <div className="p-6 border-b border-border">
        <div className="text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Activity className="w-4 h-4 animate-pulse" />
          {t('performance.loading') || 'Carregando métricas...'}
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-border">
      {/* Header com botão de collapse */}
      <div className="p-6 pb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          <h3 className="text-sm font-semibold">{t('performance.title') || 'Métricas de Performance'}</h3>
          {isPaused && (
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30 flex items-center gap-1">
              <Pause className="w-3 h-3" />
              Pausado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!collapsed && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDateFilter(!showDateFilter)}
                className="h-7 px-2 text-xs"
                title="Filtrar histórico por data"
              >
                <Calendar className="w-3 h-3 mr-1" />
                Histórico
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePause}
                className="h-7 px-2 text-xs"
                title={isPaused ? 'Retomar atualização em tempo real' : 'Pausar e ver histórico'}
              >
                {isPaused ? (
                  <>
                    <Play className="w-3 h-3 mr-1" />
                    Retomar
                  </>
                ) : (
                  <>
                    <Pause className="w-3 h-3 mr-1" />
                    Pausar
                  </>
                )}
              </Button>
              {(isPaused || historicalData.length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetToLive}
                  className="h-7 px-2 text-xs"
                  title="Voltar para tempo real"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Resetar
                </Button>
              )}
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="h-7 w-7 p-0"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {!collapsed && (
      <div>
      {/* Filtro de Data */}
      {showDateFilter && (
        <div className="px-6 py-4 border-b border-border bg-card/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <label className="text-xs text-muted-foreground">Início:</label>
              <Input
                type="date"
                value={dateFilterStart}
                onChange={(e) => setDateFilterStart(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <label className="text-xs text-muted-foreground">Fim:</label>
              <Input
                type="date"
                value={dateFilterEnd}
                onChange={(e) => setDateFilterEnd(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <Button
              size="sm"
              onClick={loadHistoricalData}
              disabled={!dateFilterStart || !dateFilterEnd || isLoadingHistory}
              className="h-8"
            >
              <Search className="w-3 h-3 mr-1" />
              {isLoadingHistory ? 'Carregando...' : 'Buscar'}
            </Button>
          </div>
          {availablePeriods.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              <span>Períodos disponíveis: </span>
              <span className="font-medium">{availablePeriods.map(p => p.label).join(', ')}</span>
            </div>
          )}
          {historicalData.length > 0 && (
            <div className="mt-2 text-xs text-emerald-400">
              {historicalData.length} métricas carregadas de {new Date(historicalData[0].timestamp).toLocaleString('pt-BR')} até {new Date(historicalData[historicalData.length - 1].timestamp).toLocaleString('pt-BR')}
            </div>
          )}
        </div>
      )}

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="p-4 space-y-2">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`flex items-center gap-2 p-3 rounded-lg border ${
                alert.level === 'critical'
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Cpu className="w-4 h-4" />
            <span className="text-xs font-medium">CPU</span>
          </div>
          <div className="text-2xl font-bold">
            {displayMetrics.cpu}%
          </div>
          <div className={`text-xs mt-1 flex items-center gap-1 ${
            parseFloat(displayMetrics.cpu) > 80 ? 'text-red-400' :
            parseFloat(displayMetrics.cpu) > 50 ? 'text-yellow-400' :
            'text-green-400'
          }`}>
            <Circle className="w-2 h-2 fill-current" />
            {parseFloat(displayMetrics.cpu) > 80 ? 'Alto' :
             parseFloat(displayMetrics.cpu) > 50 ? 'Médio' :
             'Normal'}
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <HardDrive className="w-4 h-4" />
            <span className="text-xs font-medium">RAM</span>
          </div>
          <div className="text-2xl font-bold">
            {displayMetrics.memory} MB
          </div>
          <div className={`text-xs mt-1 flex items-center gap-1 ${
            parseFloat(displayMetrics.memory) > 500 ? 'text-red-400' :
            parseFloat(displayMetrics.memory) > 250 ? 'text-yellow-400' :
            'text-green-400'
          }`}>
            <Circle className="w-2 h-2 fill-current" />
            {parseFloat(displayMetrics.memory) > 500 ? 'Alto' :
             parseFloat(displayMetrics.memory) > 250 ? 'Médio' :
             'Normal'}
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Uptime</span>
          </div>
          <div className="text-2xl font-bold">
            {formatUptime(displayMetrics.uptime)}
          </div>
          <div className="text-xs mt-1 text-muted-foreground">
            Tempo de execução
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-medium">Processos</span>
          </div>
          <div className="text-2xl font-bold">
            {displayMetrics.processCount}
          </div>
          <div className="text-xs mt-1 text-muted-foreground">
            Tasks ativas
          </div>
        </div>
      </div>

      {/* Gráficos de Performance */}
      {chartData.length > 1 && (
        <div className="px-6 pb-6 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <h3 className="text-sm font-semibold">Histórico de Performance</h3>
          </div>

          {/* Gráfico de CPU */}
          <div className="bg-card p-4 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-blue-400" />
              <h4 className="text-xs font-semibold">CPU</h4>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="time"
                  stroke="#888"
                  fontSize={9}
                  tick={{ fill: '#888' }}
                />
                <YAxis
                  stroke="#888"
                  fontSize={9}
                  tick={{ fill: '#888' }}
                  domain={[0, 100]}
                  label={{ value: '%', position: 'insideRight', fill: '#888', fontSize: 9 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="CPU (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de RAM */}
          <div className="bg-card p-4 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-3">
              <HardDrive className="w-4 h-4 text-green-400" />
              <h4 className="text-xs font-semibold">RAM</h4>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="time"
                  stroke="#888"
                  fontSize={9}
                  tick={{ fill: '#888' }}
                />
                <YAxis
                  stroke="#888"
                  fontSize={9}
                  tick={{ fill: '#888' }}
                  label={{ value: 'MB', position: 'insideRight', fill: '#888', fontSize: 9 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="memory"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="RAM (MB)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Uptime */}
          <div className="bg-card p-4 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-semibold">Uptime</h4>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="time"
                  stroke="#888"
                  fontSize={9}
                  tick={{ fill: '#888' }}
                />
                <YAxis
                  stroke="#888"
                  fontSize={9}
                  tick={{ fill: '#888' }}
                  label={{ value: 's', position: 'insideRight', fill: '#888', fontSize: 9 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [formatUptime(value), 'Uptime']}
                />
                <Line
                  type="monotone"
                  dataKey="uptime"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={false}
                  name="Uptime"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detalhes dos Processos */}
      {displayMetrics.processes.length > 0 && (
        <div className="px-6 pb-6">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <h3 className="text-sm font-semibold">Processos Individuais</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setProcessesCollapsed(!processesCollapsed)}
              className="h-7 w-7 p-0"
            >
              {processesCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
          </div>
          {!processesCollapsed && (
            <div className="space-y-2">
              {displayMetrics.processes.map((proc, index) => (
              <div key={proc.pid} className="bg-card p-3 rounded-lg border border-border">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground">
                      PID {proc.pid}
                    </span>
                    <span className="text-xs">
                      Task {index + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-xs">
                      <span className="text-muted-foreground">CPU:</span>
                      <span className="ml-1 font-medium">{proc.cpu}%</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">RAM:</span>
                      <span className="ml-1 font-medium">{proc.memory} MB</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}
        </div>
      )}
      </div>
      )}
    </div>
  )
})
