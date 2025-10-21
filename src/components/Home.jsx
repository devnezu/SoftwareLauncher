import { Play, FolderOpen, Clock, TrendingUp } from 'lucide-react'
import { useTranslation } from '../i18n/LanguageContext'

export function Home({ projects, runningProjects, onSelectProject, onNewProject }) {
  const { t } = useTranslation()

  const totalProjects = projects.length
  const activeProjects = runningProjects.size
  const recentProjects = projects.slice(0, 5)

  const stats = [
    {
      label: t('home.stats.totalProjects'),
      value: totalProjects,
      icon: FolderOpen,
      color: 'text-blue-500'
    },
    {
      label: t('home.stats.activeProjects'),
      value: activeProjects,
      icon: Play,
      color: 'text-green-500'
    },
    {
      label: t('home.stats.recentActivity'),
      value: recentProjects.length,
      icon: Clock,
      color: 'text-purple-500'
    }
  ]

  return (
    <div className="flex-1 flex flex-col p-8 overflow-auto">
      <div className="max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="mb-12 animate-fade-in">
          <h1 className="text-4xl font-light mb-3">{t('home.welcome')}</h1>
          <p className="text-muted-foreground text-lg font-light">{t('home.subtitle')}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-slide-in">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between mb-4">
                <stat.icon className={`w-8 h-8 ${stat.color}`} strokeWidth={1.5} />
                <span className="text-4xl font-extralight">{stat.value}</span>
              </div>
              <p className="text-sm text-muted-foreground font-light">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-light">{t('home.recentProjects')}</h2>
              <TrendingUp className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => onSelectProject(project)}
                  className="bg-card border border-border rounded-xl p-6 text-left hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:border-primary/50 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-light group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                    {runningProjects.has(project.id) && (
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-light line-clamp-2 mb-4">
                    {project.description || t('sidebar.noDescription')}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FolderOpen className="w-4 h-4" strokeWidth={1.5} />
                    <span className="font-light">{project.tasks?.length || 0} {t('home.tasks')}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {totalProjects === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderOpen className="w-24 h-24 text-muted-foreground/30 mb-6" strokeWidth={1} />
            <h2 className="text-2xl font-light mb-3">{t('home.empty.title')}</h2>
            <p className="text-muted-foreground text-lg font-light mb-8 max-w-md">
              {t('home.empty.subtitle')}
            </p>
            <button
              onClick={onNewProject}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-light"
            >
              {t('buttons.newProject')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
