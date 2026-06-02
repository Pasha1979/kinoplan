/**
 * ЭТАЛОННЫЙ ПРИМЕР СЕРВИСА
 * Все новые сервисы должны следовать этому стилю.
 *
 * ПРАВИЛА:
 * - Методы возвращают Promise<void> или Promise<T>
 * - Использовать useNormalizedProjectStore для доступа к состоянию
 * - try/catch/finally для обработки ошибок и isLoading
 * - Искусственная задержка MOCK_DELAY для эмуляции сети (убрать в проде)
 */
import { useNormalizedProjectStore } from '../../src/store/useProjectStore';
import type { Project } from '../../src/store/projectStore';
import type { Scene } from '../../src/store/useProjectStore';

const MOCK_DELAY = 100;

export const projectService = {
  async getProjects(): Promise<void> {
    try {
      useNormalizedProjectStore.getState().setLoading(true);
      await new Promise((r) => setTimeout(r, MOCK_DELAY));
      // TODO: заменить на реальный API-вызов
    } catch (error) {
      useNormalizedProjectStore.getState().setError('Не удалось загрузить проекты');
      throw error;
    } finally {
      useNormalizedProjectStore.getState().setLoading(false);
    }
  },

  async createProject(data: Partial<Project>): Promise<Project> {
    try {
      useNormalizedProjectStore.getState().setLoading(true);
      await new Promise((r) => setTimeout(r, MOCK_DELAY));
      const newProject: Project = {
        id: `project_${Date.now()}`,
        name: data.name || 'Новый проект',
        type: data.type || 'film',
        status: 'preproduction',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // ... остальные поля с дефолтами
      } as Project;
      useNormalizedProjectStore.getState().setProjects([newProject]);
      return newProject;
    } catch (error) {
      useNormalizedProjectStore.getState().setError('Не удалось создать проект');
      throw error;
    } finally {
      useNormalizedProjectStore.getState().setLoading(false);
    }
  },

  async saveScenesBatch(projectId: string, scenes: Scene[]): Promise<void> {
    try {
      useNormalizedProjectStore.getState().setLoading(true);
      await new Promise((r) => setTimeout(r, MOCK_DELAY));
      const scopedScenes = scenes.map((s) => ({ ...s, projectId }));
      useNormalizedProjectStore.getState().setScenesBatch(scopedScenes);
    } catch (error) {
      useNormalizedProjectStore.getState().setError('Не удалось сохранить сцены');
      throw error;
    } finally {
      useNormalizedProjectStore.getState().setLoading(false);
    }
  },

  async updateScene(sceneId: string, updates: Partial<Scene>): Promise<void> {
    try {
      useNormalizedProjectStore.getState().updateScene(sceneId, updates);
      await new Promise((r) => setTimeout(r, MOCK_DELAY));
    } catch (error) {
      useNormalizedProjectStore.getState().revertScene(sceneId);
      useNormalizedProjectStore.getState().setError('Не удалось сохранить сцену');
      throw error;
    }
  },

  async deleteProject(projectId: string): Promise<void> {
    try {
      useNormalizedProjectStore.getState().setLoading(true);
      await new Promise((r) => setTimeout(r, MOCK_DELAY));
      useNormalizedProjectStore.getState().deleteProject(projectId);
    } catch (error) {
      useNormalizedProjectStore.getState().setError('Не удалось удалить проект');
      throw error;
    } finally {
      useNormalizedProjectStore.getState().setLoading(false);
    }
  },
};
