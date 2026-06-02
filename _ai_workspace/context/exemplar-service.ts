/**
 * ЭТАЛОННЫЙ ПРИМЕР СЕРВИСА
 * Все новые сервисы должны следовать этому стилю.
 */
import { useProjectStore } from '../store/useProjectStore';
import type { Project, Scene } from '../types';

export const projectService = {
  async getProjects(): Promise<Project[]> {
    try {
      // TODO: заменить на реальный API-вызов
      const projects = useProjectStore.getState().projects;
      return Object.values(projects);
    } catch (error) {
      useProjectStore.getState().setError('Не удалось загрузить проекты');
      throw error;
    }
  },

  async updateScene(sceneId: string, updates: Partial<Scene>): Promise<void> {
    try {
      // Оптимистичное обновление
      useProjectStore.getState().updateScene(sceneId, updates);
      // TODO: заменить на реальный API-вызов
    } catch (error) {
      // Откат при ошибке
      useProjectStore.getState().revertScene(sceneId);
      useProjectStore.getState().setError('Не удалось сохранить сцену');
      throw error;
    }
  },
};
