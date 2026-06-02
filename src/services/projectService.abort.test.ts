import { describe, it, expect, vi } from 'vitest'
import { projectService } from './projectService'
import { useToastStore } from '../store/toastStore'

describe('projectService AbortController', () => {
  it('should abort saveScenesBatch request', async () => {
    const controller = new AbortController()
    
    // Запускаем запрос и сразу отменяем его
    const requestPromise = projectService.saveScenesBatch('test-proj', [], controller.signal)
    controller.abort()
    
    await expect(requestPromise).rejects.toThrow('Aborted')
  })

  it('should abort createProject request', async () => {
    const controller = new AbortController()
    
    const requestPromise = projectService.createProject({ name: 'Test' }, controller.signal)
    controller.abort()
    
    await expect(requestPromise).rejects.toThrow('Aborted')
  })

  it('should abort getProjects request', async () => {
    const controller = new AbortController()
    
    const requestPromise = projectService.getProjects(controller.signal)
    controller.abort()
    
    await expect(requestPromise).rejects.toThrow('Aborted')
  })

  it('should not show toast on abort', async () => {
    const showToastSpy = vi.spyOn(useToastStore.getState(), 'showToast')
    const controller = new AbortController()
    
    try {
      await projectService.saveScenesBatch('test-proj', [], controller.signal)
      controller.abort()
    } catch (error) {
      // Ошибка AbortError ожидается
    }
    
    // Toast не должен вызываться при отмене запроса
    expect(showToastSpy).not.toHaveBeenCalled()
    showToastSpy.mockRestore()
  })
})
