import { FolderOpen, Zap, ChevronRight, Plus, Command } from 'lucide-react'
import { Project } from '../types'
import { DynamicIcon } from './IconManager'

interface HomeProps {
    projects: Project[];
    runningProjects: Set<string>;
    onSelectProject: (project: Project) => void;
    onNewProject: () => void;
}

export function Home({ projects, runningProjects, onSelectProject, onNewProject }: HomeProps) {

  const recentProjects = projects.slice(0, 6)



  return (

    <div className="flex-1 flex flex-col p-10 overflow-auto relative z-10">

      <div className="max-w-5xl mx-auto w-full">

        

        <div className="mb-16 mt-8">

          <h1 className="text-5xl font-light mb-4 text-foreground tracking-tight">

            Welcome back.

          </h1>

          <p className="text-muted-foreground text-lg font-light">

            Select a project to launch your development environment.

          </p>

        </div>



        {/* Quick Stats Row */}

        <div className="grid grid-cols-3 gap-6 mb-12">

            <div className="bg-card dark:bg-zinc-900/30 border border-border dark:border-white/5 p-6 rounded-2xl backdrop-blur-sm shadow-sm">

                <div className="flex justify-between items-start mb-4">

                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">

                        <FolderOpen className="w-6 h-6" />

                    </div>

                    <span className="text-3xl font-semibold text-foreground dark:text-zinc-200">{projects.length}</span>

                </div>

                <span className="text-sm text-muted-foreground">Total Projects</span>

            </div>

            <div className="bg-card dark:bg-zinc-900/30 border border-border dark:border-white/5 p-6 rounded-2xl backdrop-blur-sm shadow-sm">

                <div className="flex justify-between items-start mb-4">

                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">

                        <Zap className="w-6 h-6" />

                    </div>

                    <span className="text-3xl font-semibold text-foreground dark:text-zinc-200">{runningProjects.size}</span>

                </div>

                <span className="text-sm text-muted-foreground">Active Sessions</span>

            </div>

            <button onClick={onNewProject} className="group bg-gradient-to-br from-zinc-100 to-white dark:from-zinc-800 dark:to-zinc-900 border border-border dark:border-white/10 p-6 rounded-2xl hover:border-indigo-500/50 transition-all text-left relative overflow-hidden shadow-sm">

                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex justify-between items-start mb-4 relative z-10">

                    <div className="p-3 bg-muted dark:bg-zinc-800 rounded-xl text-foreground dark:text-white group-hover:bg-indigo-500 group-hover:text-white transition-colors">

                        <Plus className="w-6 h-6" />

                    </div>

                </div>

                <span className="text-sm text-muted-foreground group-hover:text-foreground dark:group-hover:text-zinc-200 relative z-10">Create New Project</span>

            </button>

        </div>



        {/* Recent Projects List */}

        <div className="space-y-4">

            <div className="flex items-center justify-between mb-2">

                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Recent Projects</h2>

            </div>

            

            {projects.length === 0 ? (

                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-2xl">

                    <Command className="w-12 h-12 text-muted-foreground mb-4" />

                    <p className="text-muted-foreground">No projects found. Create one to get started.</p>

                </div>

            ) : (

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {recentProjects.map((project) => (

                        <button

                            key={project.id}

                            onClick={() => onSelectProject(project)}

                            className="flex items-center gap-4 p-4 bg-card hover:bg-accent/50 dark:bg-zinc-900/20 dark:hover:bg-zinc-900/50 border border-border dark:border-white/5 hover:border-indigo-200 dark:hover:border-white/10 rounded-xl transition-all group text-left shadow-sm hover:shadow-md"

                        >

                            <div className="w-12 h-12 rounded-lg bg-muted dark:bg-zinc-800 flex items-center justify-center text-muted-foreground dark:text-zinc-400 group-hover:text-foreground dark:group-hover:text-white group-hover:bg-white dark:group-hover:bg-zinc-700 transition-colors border border-transparent group-hover:border-border dark:group-hover:border-transparent">

                                <DynamicIcon name={project.icon || 'Box'} className="w-6 h-6" />

                            </div>

                            <div className="flex-1 min-w-0">

                                <h3 className="text-base font-medium text-foreground dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-white truncate transition-colors">{project.name}</h3>

                                <p className="text-xs text-muted-foreground truncate">{project.description || 'No description'}</p>

                            </div>

                            {runningProjects.has(project.id) && (

                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />

                            )}

                            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />

                        </button>

                    ))}

                </div>

            )}

        </div>



      </div>

    </div>

  )

}
