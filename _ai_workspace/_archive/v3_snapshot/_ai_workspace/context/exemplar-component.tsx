/**
 * ЭТАЛОННЫЙ ПРИМЕР КОМПОНЕНТА
 * Все новые компоненты должны следовать этому стилю.
 *
 * ПРАВИЛА:
 * - Данные ТОЛЬКО из стора (useNormalizedProjectStore)
 * - Действия ТОЛЬКО через сервис (projectService)
 * - Локальный state для UI-состояний (isSaving, isModalOpen и т.д.)
 * - Обработка ошибок через стор или toast (НЕ alert)
 * - Кнопки показывают loading-состояние (disabled, текст меняется)
 */
import { useState } from 'react';
import { useNormalizedProjectStore } from '../../src/store/useProjectStore';
import { projectService } from '../../src/services/projectService';
import type { Scene } from '../../src/store/useProjectStore';

interface ScriptEditorProps {
  projectId: string;
}

export function ScriptEditor({ projectId }: ScriptEditorProps) {
  // ✅ Данные из стора
  const { currentProjectId, isLoading, error } = useNormalizedProjectStore();
  const [isSaving, setIsSaving] = useState(false);
  const [scenes] = useState<Scene[]>([]); // Локальный state для Tiptap

  // ✅ Действия через сервис
  const handleSave = async () => {
    if (isSaving) return;
    const pid = currentProjectId ?? projectId;
    if (!pid) return;

    setIsSaving(true);
    try {
      await projectService.saveScenesBatch(pid, scenes);
      // TODO: показать toast "Сохранено"
    } catch (err) {
      // Ошибка уже записана в стор через setError
      // TODO: показать toast с текстом ошибки из стора
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="script-editor">
      {/* Кнопка Сохранить — показывает состояние загрузки */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
      >
        {isSaving ? 'Сохранение...' : 'Сохранить'}
      </button>

      {/* Ошибка из стора */}
      {error && (
        <div className="text-red-400 text-sm">{error}</div>
      )}
    </div>
  );
}
