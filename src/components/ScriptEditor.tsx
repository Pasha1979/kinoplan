import { useState, useRef, useEffect, useMemo } from 'react'
import type { ScriptFormat } from '../store/scriptStore'
import type { ProjectType } from '../store/projectStore'
import { useSmartType } from '../hooks/useSmartType'
import { parseScript, getUniqueElements } from '../utils/scriptParser'

type BlockType = 'scene_header' | 'scene_cast' | 'action' | 'character' | 'dialog' | 'parenthetical' | 'transition'

interface Block {
  id: string
  type: BlockType
  content: string
}

interface ScriptEditorProps {
  format: ScriptFormat
  projectType: ProjectType
  currentSeries: number
  fontFamily: string
  fontSize: number
  isDark: boolean
  genreCoefficient: number
  onSceneCountChange?: (count: number) => void
  onStatsChange?: (stats: { scenes: number; pages: number; duration: number }) => void
  onBlocksChange?: (blocks: Block[]) => void
  focusSceneId?: string
}

export default function ScriptEditor({ format, projectType, currentSeries, fontFamily, fontSize, isDark, genreCoefficient, onSceneCountChange, onStatsChange, onBlocksChange, focusSceneId }: ScriptEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>([
    { id: '1', type: 'scene_header', content: '' },
  ])
  const [showTutorial, setShowTutorial] = useState(true)
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  
  // SmartType для шапки сцены (scene_header suggestions)
  const [sceneHeaderSuggestions, setSceneHeaderSuggestions] = useState<Array<{text: string, type: 'scene_intro' | 'location' | 'time'}>>([])
  const [activeSceneSuggestion, setActiveSceneSuggestion] = useState(0)
  
  // SmartType для персонажей в шапке (вторая строка)
  const [castSuggestions, setCastSuggestions] = useState<string[]>([])
  const [activeCastSuggestion, setActiveCastSuggestion] = useState(0)
  
  // Блок полностью пустой при "Написать с нуля" — сценарист начинает с чистого листа

  // Извлекаем персонажей и локации для SmartType
  const { characters, locations } = useMemo(() => {
    const parsed = parseScript(blocks as any)
    const elements = getUniqueElements(parsed)
    
    const chars = elements
      .filter(e => e.category === 'cast')
      .map(e => e.name)
    
    const locs = elements
      .filter(e => e.category === 'locations')
      .map(e => e.name)
    
    return { characters: chars, locations: locs }
  }, [blocks])
  
  // Получаем подсказки персонажей для шапки сцены (вторая строка)
  const getCastSuggestions = (content: string, cursorPosition: number): string[] => {
    const beforeCursor = content.substring(0, cursorPosition)
    const lines = content.split('\n')
    const currentLineIndex = beforeCursor.split('\n').length - 1
    const currentLine = lines[currentLineIndex] || ''
    
    // Подсказки работают только на второй строке шапки (после времени)
    if (currentLineIndex !== 1) return []
    
    // Получаем слова после запятых
    const lineWords = currentLine.split(/,\s*/)
    const lastWord = lineWords[lineWords.length - 1].trim().toUpperCase()
    
    if (lastWord.length === 0) return characters.slice(0, 5)
    
    // Фильтруем персонажей по введённым буквам
    return characters
      .filter(name => name.toUpperCase().startsWith(lastWord))
      .slice(0, 5)
  }

  // SmartType для автодополнения
  const smartType = useSmartType({
    characters,
    locations,
    minMatchLength: 1,
    maxSuggestions: 5,
  })

  // Обработка фокуса на сцену из навигатора
  useEffect(() => {
    if (focusSceneId) {
      // Находим блок с нужной сценой и фокусируемся на него
      const sceneBlock = document.querySelector(`[data-block-id="${focusSceneId}"]`) as HTMLTextAreaElement
      if (sceneBlock) {
        sceneBlock.focus()
        sceneBlock.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [focusSceneId])

  // Проверяем, начал ли пользователь писать
  const hasContent = blocks.some(b => b.content.trim().length > 0)

  // Подсчёт статистики
  useEffect(() => {
    // Количество сцен
    const scenes = blocks.filter(b => b.type === 'scene_header').length

    // Подсчёт страниц (примерно: 1 страница = 2500 символов для action блоков)
    const actionBlocks = blocks.filter(b => b.type === 'action')
    const totalCharacters = actionBlocks.reduce((sum, b) => sum + b.content.length, 0)
    const pages = totalCharacters > 0 ? totalCharacters / 2500 : 0

    // Хронометраж: 1 страница = 55 секунд × жанровый коэффициент
    const duration = pages * 55 * genreCoefficient

    // Сообщаем родителю
    if (onSceneCountChange) {
      onSceneCountChange(scenes)
    }
    if (onStatsChange) {
      onStatsChange({ scenes, pages, duration })
    }
    if (onBlocksChange) {
      onBlocksChange(blocks)
    }
  }, [blocks, genreCoefficient, onSceneCountChange, onStatsChange])

  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const editorBg = isDark ? '#111126' : '#fefefe'

  // Автонумерация сцен для российского формата
  const renumberScenes = (updatedBlocks: Block[]) => {
    if (format !== 'russian') return updatedBlocks
    
    let sceneNumber = 1
    return updatedBlocks.map(block => {
      if (block.type === 'scene_header') {
        const content = block.content.trim()
        
        // Проверяем, есть ли буква в номере (например, 1-1-А)
        const letterMatch = content.match(/^(\d+-\d+-[А-ЯA-Z])\.\s*(.*)$/i)
        if (letterMatch) {
          // Сохраняем букву, если она есть
          const letter = letterMatch[1].split('-')[2]
          const baseNumber = projectType === 'serial' 
            ? `${currentSeries}-${sceneNumber}-${letter}`
            : `${sceneNumber}-${letter}`
          const newContent = `${baseNumber}. ${letterMatch[2]}`
          sceneNumber++
          return { ...block, content: newContent }
        }
        
        // Сериал: формат 1-5 (серия-сцена)
        if (projectType === 'serial') {
          const match = content.match(/^(\d+-\d+\.\s*)?(.*)$/)
          if (match) {
            const newContent = `${currentSeries}-${sceneNumber}. ${match[2]}`
            sceneNumber++
            return { ...block, content: newContent }
          }
        }
        
        // Полнометражный фильм: формат 1, 2, 3...
        const match = content.match(/^(\d+\.\s*)?(.*)$/)
        if (match) {
          const newContent = `${sceneNumber}. ${match[2]}`
          sceneNumber++
          return { ...block, content: newContent }
        }
      }
      return block
    })
  }

  // SmartType подсказки для заголовков сцен (как Final Draft + КИТ)
  // Структура: НОМЕР. ИНТ. ОБЪЕКТ. ПОДОБЪЕКТ. ВРЕМЯ
  const getSceneHeaderSuggestions = (content: string, cursorPosition: number): Array<{text: string, type: 'scene_intro' | 'location' | 'time'}> => {
    const beforeCursor = content.substring(0, cursorPosition)
    const text = beforeCursor.trim()
    
    // Проверяем структуру: номер сцены (1. или 1-1.) уже должен быть
    const hasNumber = /^(\d+[.-]?\d*\.?\s*)/.test(text)
    
    // Если ещё нет номера сцены — предлагаем ИНТ/ЭКСТ сразу (для первой сцены)
    let afterNumber = text
    if (hasNumber) {
      afterNumber = text.replace(/^(\d+[.-]?\d*\.?\s*)/, '').trim()
    }
    
    const words = afterNumber.split(/\s+/).filter(w => w)
    const lastWord = words[words.length - 1] || ''
    
    // Проверяем что уже есть в тексте
    const hasINT = /ИНТ\.?/i.test(afterNumber)
    const hasEXT = /ЭКСТ\.?/i.test(afterNumber)
    const hasSceneIntro = hasINT || hasEXT
    
    // 1. После номера сцены или в начале: И или Э → подсказка ИНТ./ЭКСТ.
    if (!hasSceneIntro && afterNumber.length <= 2) {
      if (afterNumber.toUpperCase().startsWith('И')) {
        return [{ text: 'ИНТ.', type: 'scene_intro' }]
      }
      if (afterNumber.toUpperCase().startsWith('Э')) {
        return [{ text: 'ЭКСТ.', type: 'scene_intro' }]
      }
    }
    
    // 2. После ИНТ./ЭКСТ. — подсказки локаций (ОБЪЕКТ)
    if (hasSceneIntro && words.length >= 1) {
      // Если последнее слово это ИНТ или ЭКСТ с точкой — ещё не вводили локацию
      if (/^(ИНТ|ЭКСТ)\.?$/i.test(lastWord)) {
        return []
      }
      
      // 3. После тире или точки — подсказки времени (ДЕНЬ, НОЧЬ, УТРО, ВЕЧЕР)
      const lastChar = beforeCursor.trim().slice(-1)
      const hasSeparator = lastChar === '-' || lastChar === '—' || lastChar === '.'
      const timeWords = ['ДЕНЬ', 'НОЧЬ', 'УТРО', 'ВЕЧЕР', 'РАССВЕТ', 'ЗАКАТ']
      
      // Если есть разделитель или последнее слово похоже на время — добавляем точку!
      if (hasSeparator || timeWords.some(t => t.startsWith(lastWord.toUpperCase()))) {
        const matches = timeWords
          .filter(t => t.startsWith(lastWord.toUpperCase()))
          .slice(0, 3)
          .map(t => ({ text: t + '.', type: 'time' as const }))
        if (matches.length > 0) return matches
      }
      
      // Иначе — подсказываем стандартные локации
      const standardLocations = ['КВАРТИРА', 'УЛИЦА', 'ОФИС', 'КОМНАТА', 'ДОМ', 'МАШИНА', 'КАФЕ', 'РЕСТОРАН', 'ПАРК', 'БОЛЬНИЦА']
      const matches = standardLocations
        .filter(loc => loc.toUpperCase().startsWith(lastWord.toUpperCase()))
        .slice(0, 3)
        .map(loc => ({ text: loc, type: 'location' as const }))
      return matches
    }
    
    return []
  }

  // Применение подсказки (вызывается по Tab/Enter)
  const applySuggestion = (content: string, cursorPosition: number, suggestion: {text: string, type: string}): string => {
    const beforeCursor = content.substring(0, cursorPosition)
    const afterCursor = content.substring(cursorPosition)
    
    // Находим начало последнего слова (после последнего пробела)
    const lastSpaceIndex = beforeCursor.lastIndexOf(' ')
    const lastWordStart = lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1
    
    // Заменяем последнее слово на подсказку
    const newBefore = beforeCursor.substring(0, lastWordStart) + suggestion.text
    
    return newBefore + afterCursor
  }

  // Автоопределение типа блока по содержимому
  // Сохранено для будущей кнопки автоформатирования (как кнопка "F" в Filmtoolz)
  // Пока НЕ используем автоматически — тип блока меняется только явно через Tab или кнопку
  /*
  const detectBlockType = (content: string): BlockType => {
    const trimmed = content.trim().toUpperCase()
    
    // Российский формат заголовка сцены: "1. ИНТ. КУХНЯ — ДЕНЬ" или "ИНТ. КУХНЯ — ДЕНЬ"
    if (format === 'russian') {
      const russianSceneRegex = /^(\d+\.\s*)?(ИНТ\.|ЭКСТ\.)/i
      if (russianSceneRegex.test(trimmed)) return 'scene_header'
    }
    
    // Голливудский формат заголовка сцены: "INT. KITCHEN - DAY"
    if (format === 'hollywood') {
      const hollywoodSceneRegex = /^(INT\.|EXT\.)/i
      if (hollywoodSceneRegex.test(trimmed)) return 'scene_header'
    }
    
    // Переход: содержит слова НАПЛЫВ, РАСТЯЖКА, ПЕРЕХОД и т.д.
    if (/НАПЛЫВ|РАСТЯЖКА|ПЕРЕХОД|ПРИБЛИЖЕНИЕ|ОТЪЕЗД/.test(trimmed)) {
      return 'transition'
    }
    
    // Ремарка: в скобках
    if (/^\(.*\)$/.test(content.trim())) {
      return 'parenthetical'
    }
    
    // Персонаж: короткая строка в верхнем регистре без цифр
    if (trimmed.length < 30 && /^[А-ЯA-Z\s]+$/.test(trimmed) && !/\d/.test(trimmed)) {
      return 'character'
    }
    
    // По умолчанию - действие
    return 'action'
  }
  */

  const getUppercase = (type: BlockType) => {
    return type === 'scene_header' || type === 'character' || type === 'transition'
  }

  const getBlockTypeLabel = (type: BlockType) => {
    const labels: Record<BlockType, string> = {
      scene_header: 'Заголовок сцены',
      scene_cast: 'Участники сцены',
      action: 'Действие',
      character: 'Персонаж',
      dialog: 'Диалог',
      parenthetical: 'Ремарка',
      transition: 'Переход',
    }
    return labels[type]
  }

  const getBlockTypeColor = (type: BlockType) => {
    const colors: Record<BlockType, string> = {
      scene_header: '#818cf8',
      scene_cast: '#ec4899',
      action: '#22c55e',
      character: '#f59e0b',
      dialog: '#3b82f6',
      parenthetical: '#8b5cf6',
      transition: '#ef4444',
    }
    return colors[type]
  }

  const handleKeyDown = (e: React.KeyboardEvent, blockId: string) => {
    // Подсказки шапки (sceneHeaderSuggestions) приоритетнее smartType
    if (sceneHeaderSuggestions.length > 0) {
      // Не даём smartType обработать клавиши
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveSceneSuggestion(prev => (prev + 1) % sceneHeaderSuggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveSceneSuggestion(prev => (prev - 1 + sceneHeaderSuggestions.length) % sceneHeaderSuggestions.length)
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        const suggestion = sceneHeaderSuggestions[activeSceneSuggestion]
        if (suggestion) {
          const block = blocks.find(b => b.id === blockId)
          if (block) {
            const target = e.currentTarget as HTMLTextAreaElement
            const newText = applySuggestion(block.content, target.selectionStart, suggestion)
            handleContentChange(blockId, newText)
            setSceneHeaderSuggestions([])
            
            // Если применили подсказку времени (ДЕНЬ., НОЧЬ. и т.д.) — переносим курсор на новую строку
            if (suggestion.type === 'time') {
              setTimeout(() => {
                // Находим textarea внутри блока
                const blockContainer = document.querySelector(`[data-block-id="${blockId}"]`)
                const textarea = blockContainer?.querySelector('textarea') as HTMLTextAreaElement
                if (textarea) {
                  // Добавляем перенос строки и ставим курсор в начало новой строки
                  const currentContent = textarea.value
                  const newContent = currentContent + '\n'
                  handleContentChange(blockId, newContent, newContent.length)
                  
                  // Фокус и курсор в начало новой строки
                  textarea.focus()
                  textarea.setSelectionRange(newContent.length, newContent.length)
                }
              }, 50)
            }
            return
          }
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setSceneHeaderSuggestions([])
        return
      }
    }
    
    // SmartType: навигация по подсказкам (только если нет подсказок шапки)
    if (smartType.isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        smartType.navigateSuggestions('down')
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        smartType.navigateSuggestions('up')
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        const suggestion = smartType.suggestions[smartType.activeIndex]
        if (suggestion) {
          const block = blocks.find(b => b.id === blockId)
          if (block) {
            const target = e.currentTarget as HTMLTextAreaElement
            const { newText } = smartType.selectSuggestion(
              block.content,
              target.selectionStart,
              suggestion
            )
            handleContentChange(blockId, newText)
            return
          }
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        smartType.closeSuggestions()
        return
      }
    }

    // СНАЧАЛА проверяем подсказки шапки (sceneHeaderSuggestions) — они приоритетнее
    if (sceneHeaderSuggestions.length > 0) {
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        const suggestion = sceneHeaderSuggestions[activeSceneSuggestion]
        if (suggestion) {
          const block = blocks.find(b => b.id === blockId)
          if (block) {
            const target = e.currentTarget as HTMLTextAreaElement
            const newText = applySuggestion(block.content, target.selectionStart, suggestion)
            handleContentChange(blockId, newText)
            setSceneHeaderSuggestions([])
            
            console.log('Suggestion applied:', { text: suggestion.text, type: suggestion.type, newText })
            
            // Если применили подсказку времени (ДЕНЬ., НОЧЬ. и т.д.) — автоматически создаём блок участников
            if (suggestion.type === 'time') {
              console.log('Creating scene_cast block...')
              setTimeout(() => {
                const blockIndex = blocks.findIndex(b => b.id === blockId)
                if (blockIndex === -1) return
                
                const newBlock: Block = {
                  id: crypto.randomUUID(),
                  type: 'scene_cast',
                  content: '',
                }
                const newBlocks = [...blocks]
                newBlocks.splice(blockIndex + 1, 0, newBlock)
                setBlocks(newBlocks)
                
                // Фокус на новый блок
                setTimeout(() => {
                  const newBlockEl = document.querySelector(`[data-block-id="${newBlock.id}"]`) as HTMLTextAreaElement
                  if (newBlockEl) newBlockEl.focus()
                }, 50)
              }, 50)
            }
            return
          }
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setSceneHeaderSuggestions([])
        return
      }
      // Навигация стрелками
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveSceneSuggestion(prev => (prev + 1) % sceneHeaderSuggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveSceneSuggestion(prev => (prev - 1 + sceneHeaderSuggestions.length) % sceneHeaderSuggestions.length)
        return
      }
    }

    // Ctrl+S — сохранение (заглушка)
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault()
      console.log('Сохранение сценария...')
      return
    }

    // Tab без подсказок — переключает тип блока или создаёт новый блок
    if (e.key === 'Tab' && !smartType.isOpen && sceneHeaderSuggestions.length === 0) {
      e.preventDefault()
      const blockIndex = blocks.findIndex(b => b.id === blockId)
      if (blockIndex === -1) return
      
      const currentBlock = blocks[blockIndex]
      
      // Если шапка сцены завершена (время + точка), создаём блок участников
      if (currentBlock.type === 'scene_header') {
        const hasCompleteTime = /(ДЕНЬ|НОЧЬ|УТРО|ВЕЧЕР|РАССВЕТ|ЗАКАТ)\./i.test(currentBlock.content)
        if (hasCompleteTime) {
          // Создаём новый блок scene_cast (участники сцены)
          const newBlock: Block = {
            id: crypto.randomUUID(),
            type: 'scene_cast',
            content: '',
          }
          const newBlocks = [...blocks]
          newBlocks.splice(blockIndex + 1, 0, newBlock)
          setBlocks(newBlocks)
          
          // Фокус на новый блок
          setTimeout(() => {
            const newBlockEl = document.querySelector(`[data-block-id="${newBlock.id}"]`) as HTMLTextAreaElement
            if (newBlockEl) newBlockEl.focus()
          }, 0)
          return
        }
      }

      // Иначе — просто переключаем тип текущего блока
      const types: BlockType[] = ['scene_header', 'scene_cast', 'action', 'character', 'dialog', 'parenthetical', 'transition']
      const currentIndex = types.indexOf(currentBlock.type)
      const nextIndex = e.shiftKey ? (currentIndex - 1 + types.length) % types.length : (currentIndex + 1) % types.length

      setBlocks(blocks.map((b, i) => 
        i === blockIndex ? { ...b, type: types[nextIndex] } : b
      ))
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Enter создаёт новый блок
      const blockIndex = blocks.findIndex(b => b.id === blockId)
      if (blockIndex === -1) return

      const currentBlock = blocks[blockIndex]
      let nextType: BlockType = 'action'

      // Автопереход: scene_header → scene_cast → action → character → dialog
      if (currentBlock.type === 'scene_header') nextType = 'scene_cast'
      else if (currentBlock.type === 'scene_cast') nextType = 'action'
      else if (currentBlock.type === 'action') nextType = 'character'
      else if (currentBlock.type === 'character') nextType = 'dialog'
      else if (currentBlock.type === 'dialog') nextType = 'action'
      else if (currentBlock.type === 'parenthetical') nextType = 'dialog'
      else if (currentBlock.type === 'transition') nextType = 'scene_header'

      const newBlock: Block = {
        id: crypto.randomUUID(),
        type: nextType,
        content: '',
      }

      const newBlocks = [...blocks]
      newBlocks.splice(blockIndex + 1, 0, newBlock)
      
      // Применяем автонумерацию если добавили сцену
      const renumberedBlocks = newBlock.type === 'scene_header' 
        ? renumberScenes(newBlocks)
        : newBlocks
      setBlocks(renumberedBlocks)

      // Фокус на новый блок
      setTimeout(() => {
        const newBlockEl = document.querySelector(`[data-block-id="${newBlock.id}"]`) as HTMLTextAreaElement
        if (newBlockEl) newBlockEl.focus()
      }, 0)
    }

    if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter — новая строка в том же блоке
      // Разрешаем стандартное поведение
    }

    // Навигация стрелками между блоками
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const blockIndex = blocks.findIndex(b => b.id === blockId)
      if (blockIndex === -1) return

      const textarea = e.target as HTMLTextAreaElement
      const { selectionStart, selectionEnd, value } = textarea
      
      // Проверяем, есть ли текст выше/ниже курсора
      const hasTextAbove = selectionStart > 0 && value.substring(0, selectionStart).includes('\n')
      const hasTextBelow = selectionEnd < value.length && value.substring(selectionEnd).includes('\n')
      
      // Переход к предыдущему блоку только если курсор в начале и нет текста выше
      if (e.key === 'ArrowUp' && selectionStart === 0 && !hasTextAbove && blockIndex > 0) {
        e.preventDefault()
        const prevBlockId = blocks[blockIndex - 1].id
        setTimeout(() => {
          const prevBlockEl = document.querySelector(`[data-block-id="${prevBlockId}"]`) as HTMLTextAreaElement
          if (prevBlockEl) {
            prevBlockEl.focus()
            prevBlockEl.setSelectionRange(prevBlockEl.value.length, prevBlockEl.value.length)
          }
        }, 0)
      }
      
      // Переход к следующему блоку только если курсор в конце и нет текста ниже
      if (e.key === 'ArrowDown' && selectionEnd === value.length && !hasTextBelow && blockIndex < blocks.length - 1) {
        e.preventDefault()
        const nextBlockId = blocks[blockIndex + 1].id
        setTimeout(() => {
          const nextBlockEl = document.querySelector(`[data-block-id="${nextBlockId}"]`) as HTMLTextAreaElement
          if (nextBlockEl) {
            nextBlockEl.focus()
            nextBlockEl.setSelectionRange(0, 0)
          }
        }, 0)
      }
    }
  }

  const handleContentChange = (blockId: string, content: string, cursorPosition?: number) => {
    const block = blocks.find(b => b.id === blockId)
    if (!block) return

    // SmartType для шапки сцены: показываем подсказки, но НЕ меняем текст автоматически
    if (block.type === 'scene_header' && cursorPosition !== undefined) {
      const suggestions = getSceneHeaderSuggestions(content, cursorPosition)
      setSceneHeaderSuggestions(suggestions)
      setActiveSceneSuggestion(0)
      
      // Проверяем подсказки персонажей на второй строке (после времени)
      const beforeCursor = content.substring(0, cursorPosition)
      const currentLineIndex = beforeCursor.split('\n').length - 1
      if (currentLineIndex === 1) {
        // Вторая строка — подсказки персонажей
        const castSugs = getCastSuggestions(content, cursorPosition)
        setCastSuggestions(castSugs)
        setActiveCastSuggestion(0)
      } else {
        setCastSuggestions([])
      }
    } else {
      setSceneHeaderSuggestions([])
      setCastSuggestions([])
    }

    // Обновляем блоки — тип НЕ меняется при редактировании текста!
    // Автонумерацию НЕ применяем здесь — она мешает вводу (переписывает номера)
    // Автонумерация делается только при добавлении новой сцены (в handleKeyDown)
    const updatedBlocks = blocks.map(b => {
      if (b.id === blockId) {
        return { ...b, content }
      }
      return b
    })
    setBlocks(updatedBlocks)

    // Обновляем подсказки SmartType (для персонажей и локаций)
    if (cursorPosition !== undefined) {
      // Для scene_cast показываем подсказки персонажей (как для character)
      const smartTypeBlockType = block?.type === 'scene_cast' ? 'character' : (block?.type || 'action')
      smartType.updateSuggestions(content, cursorPosition, smartTypeBlockType)
    }
  }

  return (
    <div 
      ref={editorRef}
      className="flex-1 overflow-y-auto py-10 px-8 relative"
      style={{ background: editorBg }}
    >
      {/* Окно обучения */}
      {showTutorial && (
        <div className="absolute inset-0 flex items-center justify-center z-10"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="max-w-lg p-8 rounded-2xl"
            style={{ background: isDark ? '#1a1a35' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: textPrimary }}>Как пользоваться редактором</h3>
            <ul className="space-y-3 text-sm mb-6" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
              <li><strong>Tab</strong> — переключить тип блока</li>
              <li><strong>Shift+Tab</strong> — переключить назад</li>
              <li><strong>Enter</strong> — создать новый блок</li>
              <li><strong>Shift+Enter</strong> — новая строка в том же блоке</li>
            </ul>
            <button
              onClick={() => setShowTutorial(false)}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#ffffff' }}
            >
              Понятно, начинаю писать
            </button>
          </div>
        </div>
      )}

      <div className="w-full h-full flex flex-col px-4" style={{ fontFamily: `${fontFamily}, monospace`, fontSize: `${fontSize}pt` }}>
        {/* Объяснение если сценарий пустой */}
        {!hasContent && (
          <div className="py-4 text-center shrink-0">
            <h3 className="text-sm font-bold mb-2" style={{ color: textPrimary }}>
              Начните писать сценарий
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
              Нажмите <strong>Tab</strong> для переключения типа блока,<br />
              <strong>Enter</strong> для создания нового блока
            </p>
          </div>
        )}

        {/* Блоки сценария - занимают всё оставшееся пространство */}
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
          {blocks.map((block) => {
            // Action блоки занимают больше вертикального пространства
            const isAction = block.type === 'action'
            const minHeight = isAction ? 'min-h-[200px]' : 'min-h-[40px]'
            
            // Отступы по типам блоков
            const getPaddingClass = () => {
              switch (block.type) {
                case 'character':
                  return 'pl-[20%]'
                case 'dialog':
                  return 'pl-[15%]'
                case 'parenthetical':
                  return 'pl-[25%]'
                case 'transition':
                  return 'pl-[60%]'
                default:
                  return ''
              }
            }
            
            return (
              <div
                key={block.id}
                data-block-id={block.id}
                className={`${minHeight} ${isAction ? 'flex-1' : ''} ${getPaddingClass()} flex flex-col`}
              >
                {/* Badge с типом блока */}
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span 
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider"
                    style={{ 
                      background: `${getBlockTypeColor(block.type)}20`,
                      color: getBlockTypeColor(block.type),
                    }}
                  >
                    {getBlockTypeLabel(block.type)}
                  </span>
                  <span className="text-[10px] opacity-50" style={{ color: textPrimary }}>
                    Tab → переключить
                  </span>
                </div>
                <div className="relative">
                  <textarea
                    value={block.content}
                    onChange={(e) => {
                      const cursorPos = e.target.selectionStart
                      handleContentChange(block.id, e.target.value, cursorPos)
                      setActiveBlockId(block.id)
                    }}
                    onKeyDown={(e) => handleKeyDown(e, block.id)}
                    onFocus={() => setActiveBlockId(block.id)}
                  className="w-full flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed"
                  style={{
                    color: textPrimary,
                    lineHeight: '1.8',
                    textTransform: getUppercase(block.type) ? 'uppercase' : 'none',
                    fontWeight: block.type === 'character' ? 'bold' : 'normal',
                  }}
                  placeholder={
                    block.type === 'scene_header' 
                      ? (format === 'russian' ? '1. ИНТ. ЛОКАЦИЯ — ДЕНЬ' : 'INT. LOCATION - DAY')
                      : block.type === 'scene_cast'
                        ? 'ПЕТРОВ, ИВАНОВ, СИДОРОВ...'
                        : ''
                  }
                />
                
                {/* SmartType подсказки */}
                {smartType.isOpen && activeBlockId === block.id && (
                  <div className="absolute left-0 right-0 bottom-full mb-1 z-50">
                    <div className="rounded-lg shadow-lg border overflow-hidden max-h-48 overflow-y-auto"
                      style={{
                        background: isDark ? '#1a1a2e' : '#ffffff',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
                      }}>
                      {smartType.suggestions.map((suggestion, index) => {
                        const isActive = index === smartType.activeIndex
                        const colors = {
                          character: '#818cf8',
                          location: '#22c55e',
                          prop: '#f59e0b',
                          time: '#6b7280',
                        }
                        return (
                          <div
                            key={suggestion.id}
                            className={`px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors ${isActive ? (isDark ? 'bg-white/10' : 'bg-gray-100') : ''}`}
                            style={{
                              borderLeft: isActive ? `3px solid ${colors[suggestion.type]}` : '3px solid transparent',
                            }}
                          >
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{
                                background: `${colors[suggestion.type]}20`,
                                color: colors[suggestion.type],
                                fontSize: '10px',
                              }}>
                              {suggestion.type === 'character' ? 'ПЕРС' :
                               suggestion.type === 'location' ? 'ЛОК' :
                               suggestion.type === 'prop' ? 'РЕКВ' : 'ВРЕМ'}
                            </span>
                            <span className="text-sm" style={{ color: isDark ? '#f1f5f9' : '#111827' }}>
                              {suggestion.text}
                            </span>
                          </div>
                        )
                      })}
                      <div className="px-3 py-1 text-[10px] border-t"
                        style={{
                          color: isDark ? '#6b7280' : '#9ca3af',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
                        }}>
                        ↑↓ для навигации, Tab/Enter для выбора, Esc для закрытия
                      </div>
                    </div>
                  </div>
                )}
                
                {/* SmartType подсказки для шапки сцены — inline чип справа */}
                {sceneHeaderSuggestions.length > 0 && activeBlockId === block.id && block.type === 'scene_header' && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 z-[100]">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium animate-pulse"
                      style={{
                        background: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(37, 99, 235, 0.15)',
                        color: isDark ? '#60a5fa' : '#2563eb',
                        border: isDark ? '1px solid rgba(96, 165, 250, 0.4)' : '1px solid rgba(37, 99, 235, 0.3)',
                        backdropFilter: 'blur(4px)',
                      }}>
                      <span>{sceneHeaderSuggestions[activeSceneSuggestion].text}</span>
                      <span style={{ opacity: 0.6, fontSize: '10px' }}>↵</span>
                    </div>
                    {sceneHeaderSuggestions.length > 1 && (
                      <div className="text-[10px] mt-1 text-center" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                        ↑↓ {sceneHeaderSuggestions.length} варианта
                      </div>
                    )}
                  </div>
                )}
                
                {/* SmartType подсказки персонажей в шапке */}
                {castSuggestions.length > 0 && activeBlockId === block.id && block.type === 'scene_header' && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 z-[100]">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium animate-pulse"
                      style={{
                        background: isDark ? 'rgba(236, 72, 153, 0.3)' : 'rgba(236, 72, 153, 0.15)',
                        color: isDark ? '#f472b6' : '#db2777',
                        border: isDark ? '1px solid rgba(244, 114, 182, 0.4)' : '1px solid rgba(219, 39, 119, 0.3)',
                        backdropFilter: 'blur(4px)',
                      }}>
                      <span>{castSuggestions[activeCastSuggestion]}</span>
                      <span style={{ opacity: 0.6, fontSize: '10px' }}>, ↵</span>
                    </div>
                    {castSuggestions.length > 1 && (
                      <div className="text-[10px] mt-1 text-center" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                        ↑↓ {castSuggestions.length} варианта
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
