/**
 * ЭТАЛОННЫЙ ПРИМЕР КОМПОНЕНТА
 * Все новые компоненты должны следовать этому стилю.
 */
import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { projectService } from '../services/projectService';
import type { Scene } from '../types';

interface SceneEditorProps {
  sceneId: string;
}

export function SceneEditor({ sceneId }: SceneEditorProps) {
  // ✅ Данные ТОЛЬКО из стора
  const scene = useProjectStore((s) => s.scenes[sceneId]);
  const isLoading = useProjectStore((s) => s.isLoading);
  const error = useProjectStore((s) => s.error);

  // ✅ Действия ТОЛЬКО через сервис
  const handleUpdate = async (updates: Partial<Scene>) => {
    await projectService.updateScene(sceneId, updates);
  };

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!scene) return <NotFound />;

  return (
    <div className="scene-editor">
      {/* ... */}
    </div>
  );
}
