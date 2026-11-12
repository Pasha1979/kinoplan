// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { projectService } from './projectService'
import { useToastStore } from '../store/toastStore'

describe('projectService AbortController', () => {
  it('should abort saveScenesBatch request', async () => {
    const controller = new AbortController()
    
    // Запускаем запрос и сразу отменяем его
    controller.abort()
    const requestPromise = projectService.saveScenesBatch('test-proj', [], controller.signal)
    
    await expect(requestPromise).rejects.toThrow('Aborted')
  })

  it('should abort createProject request', async () => {
    const controller = new AbortController()
    
    controller.abort()
    const requestPromise = projectService.createProject({ name: 'Test' }, controller.signal)
    
    await expect(requestPromise).rejects.toThrow('Aborted')
  })

  it('should abort getProjects request', async () => {
    const controller = new AbortController()
    
    controller.abort()
    const requestPromise = projectService.getProjects(controller.signal)
    
    await expect(requestPromise).rejects.toThrow('Aborted')
  })

  it('should not show toast on abort', async () => {
    const showToastSpy = vi.spyOn(useToastStore.getState(), 'showToast')
    const controller = new AbortController()
    
    try {
      controller.abort()
      await projectService.saveScenesBatch('test-proj', [], controller.signal)
    } catch {
      // Ошибка AbortError ожидается
    }
    
    // Toast не должен вызываться при отмене запроса
    expect(showToastSpy).not.toHaveBeenCalled()
    showToastSpy.mockRestore()
  })
})
