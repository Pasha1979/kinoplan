import { useMemo } from 'react'
import { Users, AlertTriangle, TrendingUp, Clock, Hash } from 'lucide-react'

export interface CharacterData {
  id: string
  name: string
  sceneIds: string[]
  dialogPages: number
  firstAppearance: string // номер сцены
  lastAppearance: string // номер сцены
  appearanceGaps: Array<{ from: string; to: string; pages: number }>
}

interface CharacterStatsProps {
  characters: CharacterData[]
  totalScenes: number
  isDark: boolean
}

export default function CharacterStats({ characters, totalScenes, isDark }: CharacterStatsProps) {
  const cardBg = isDark ? '#13132a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'

  // Сортируем персонажей по важности (количество сцен)
  const sortedCharacters = useMemo(() => {
    return [...characters].sort((a, b) => b.sceneIds.length - a.sceneIds.length)
  }, [characters])

  // Определяем категорию важности
  const getCharacterCategory = (sceneCount: number, total: number) => {
    const ratio = sceneCount / total
    if (ratio >= 0.5) return { label: 'Главный герой', color: '#818cf8', level: 1 }
    if (ratio >= 0.2) return { label: 'Второстепенный', color: '#22c55e', level: 2 }
    if (ratio >= 0.05) return { label: 'Эпизодик', color: '#f59e0b', level: 3 }
    return { label: 'Камео', color: '#6b7280', level: 4 }
  }

  // Ищем проблемы
  const issues = useMemo(() => {
    const problems: Array<{ type: 'warning' | 'error'; message: string; character: string }> = []
    
    sortedCharacters.forEach(char => {
      // Проверяем пропадание на долгие промежутки
      char.appearanceGaps.forEach(gap => {
        if (gap.pages > 15) {
          problems.push({
            type: 'warning',
            message: `Пропал на ${gap.pages} страниц (сц. ${gap.from} → ${gap.to})`,
            character: char.name,
          })
        }
      })
      
      // Проверяем мало сцен для главного героя
      const category = getCharacterCategory(char.sceneIds.length, totalScenes)
      if (category.level === 1 && char.sceneIds.length < 5) {
        problems.push({
          type: 'warning',
          message: 'Мало сцен для главного героя',
          character: char.name,
        })
      }
    })
    
    return problems.slice(0, 5) // Показываем топ-5 проблем
  }, [sortedCharacters, totalScenes])

  // Максимальное значение для масштаба графика
  const maxScenes = sortedCharacters[0]?.sceneIds.length || 1

  return (
    <div className="flex-1 flex overflow-hidden" style={{ background: isDark ? '#0f0f20' : '#f5f5f5' }}>
      
      {/* Левая панель — список персонажей */}
      <div className="w-96 flex flex-col border-r overflow-hidden"
        style={{ background: cardBg, borderColor: border }}>
        
        {/* Шапка */}
        <div className="p-4 border-b" style={{ borderColor: border }}>
          <div className="flex items-center gap-2 mb-3">
            <Users size={18} style={{ color: '#818cf8' }} />
            <h2 className="text-sm font-bold" style={{ color: textPrimary }}>
              Баланс персонажей
            </h2>
          </div>
          <p className="text-xs" style={{ color: textSecondary }}>
            {characters.length} персонажей · {totalScenes} сцен
          </p>
        </div>

        {/* Список персонажей */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sortedCharacters.length === 0 ? (
            <div className="text-center py-8">
              <Users size={32} className="mx-auto mb-2" style={{ color: textSecondary, opacity: 0.5 }} />
              <p className="text-xs" style={{ color: textSecondary }}>
                Нет данных о персонажах.
                <br />
                Начните писать сценарий — персонажи появятся автоматически.
              </p>
            </div>
          ) : (
            sortedCharacters.map((char, index) => {
              const category = getCharacterCategory(char.sceneIds.length, totalScenes)
              const percentage = (char.sceneIds.length / totalScenes) * 100
              const barWidth = (char.sceneIds.length / maxScenes) * 100
              
              return (
                <div
                  key={char.id}
                  className={`rounded-lg border p-3 transition-all hover:scale-[1.02] ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                  style={{ borderColor: border }}
                >
                  {/* Имя и категория */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold" style={{ color: textPrimary }}>
                      {char.name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: `${category.color}20`, color: category.color }}>
                      {category.label}
                    </span>
                  </div>
                  
                  {/* Визуальный бар */}
                  <div className="h-2 rounded-full mb-2 overflow-hidden"
                    style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${barWidth}%`, background: category.color }} />
                  </div>
                  
                  {/* Статистика */}
                  <div className="flex items-center gap-4 text-xs" style={{ color: textSecondary }}>
                    <span className="flex items-center gap-1">
                      <Hash size={10} />
                      {char.sceneIds.length} сцен
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp size={10} />
                      {percentage.toFixed(0)}%
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {char.dialogPages.toFixed(1)} стр. диалога
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Центральная область — аналитика и проблемы */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Шапка */}
        <div className="shrink-0 px-6 py-3 border-b flex items-center justify-between"
          style={{ background: cardBg, borderColor: border }}>
          <h3 className="text-sm font-bold" style={{ color: textPrimary }}>
            Анализ и рекомендации
          </h3>
          {issues.length > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500">
              {issues.length} рекомендаций
            </span>
          )}
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Сводка */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Главных героев', value: sortedCharacters.filter(c => getCharacterCategory(c.sceneIds.length, totalScenes).level === 1).length, color: '#818cf8' },
              { label: 'Второстепенных', value: sortedCharacters.filter(c => getCharacterCategory(c.sceneIds.length, totalScenes).level === 2).length, color: '#22c55e' },
              { label: 'Эпизодиков', value: sortedCharacters.filter(c => getCharacterCategory(c.sceneIds.length, totalScenes).level === 3).length, color: '#f59e0b' },
              { label: 'Камео', value: sortedCharacters.filter(c => getCharacterCategory(c.sceneIds.length, totalScenes).level === 4).length, color: '#6b7280' },
            ].map((stat, i) => (
              <div key={i} className="rounded-lg p-3 border" style={{ borderColor: border, background: isDark ? 'rgba(255,255,255,0.03)' : '#fafafa' }}>
                <p className="text-2xl font-bold mb-1" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-xs" style={{ color: textSecondary }}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Проблемы */}
          {issues.length > 0 ? (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: border }}>
              <div className="px-4 py-2 border-b flex items-center gap-2"
                style={{ borderColor: border, background: isDark ? 'rgba(255,255,255,0.03)' : '#fafafa' }}>
                <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
                <span className="text-xs font-medium" style={{ color: textPrimary }}>
                  Обнаружены потенциальные проблемы
                </span>
              </div>
              <div className="p-2 space-y-1">
                {issues.map((issue, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 rounded-lg"
                    style={{ background: isDark ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.08)' }}>
                    <span className="text-xs font-bold shrink-0"
                      style={{ color: issue.type === 'error' ? '#ef4444' : '#f59e0b' }}>
                      {issue.character}
                    </span>
                    <span className="text-xs" style={{ color: textSecondary }}>
                      {issue.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 rounded-lg border" style={{ borderColor: border }}>
              <TrendingUp size={32} className="mx-auto mb-2" style={{ color: '#22c55e', opacity: 0.5 }} />
              <p className="text-sm font-medium mb-1" style={{ color: textPrimary }}>
                Всё в порядке!
              </p>
              <p className="text-xs" style={{ color: textSecondary }}>
                Проблем с балансом персонажей не обнаружено
              </p>
            </div>
          )}

          {/* Рекомендации по структуре */}
          <div className="mt-6 rounded-lg border p-4" style={{ borderColor: border }}>
            <h4 className="text-sm font-bold mb-3" style={{ color: textPrimary }}>
              Рекомендации по структуре
            </h4>
            <ul className="space-y-2 text-xs" style={{ color: textSecondary }}>
              <li className="flex items-start gap-2">
                <span style={{ color: '#22c55e' }}>✓</span>
                Оптимальное количество главных героев: 1-3 персонажа
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: '#22c55e' }}>✓</span>
                Главный герой должен быть в 50%+ сцен
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: '#f59e0b' }}>⚠</span>
                Второстепенные персонажи: появление каждые 10-15 страниц
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: '#ef4444' }}>✗</span>
                Избегайте пропаданий персонажей более чем на 20 страниц
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
