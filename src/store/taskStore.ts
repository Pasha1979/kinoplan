import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Task, ActivityEvent } from './projectStore'

interface TaskStore {
  tasks: Task[]
  activity: ActivityEvent[]
  addTask: (task: Task) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  addActivity: (event: ActivityEvent) => void
  getProjectTasks: (projectId: string) => Task[]
  getProjectActivity: (projectId: string) => ActivityEvent[]
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
  tasks: [],
  activity: [],

  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),

  updateTask: (id, patch) =>
    set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...patch } : t) })),

  addActivity: (event) =>
    set((s) => ({ activity: [event, ...s.activity].slice(0, 50) })),

  getProjectTasks: (projectId) =>
    get().tasks.filter((t) => t.projectId === projectId),

  getProjectActivity: (projectId) =>
    get().activity.filter((a) => a.projectId === projectId),
  }),
  { name: 'kinoplan-tasks' }
)
)
