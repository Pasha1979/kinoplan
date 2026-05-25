import { FileText, Clock } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

export default function ScriptPage() {
  const { theme } = useUiStore()

  return (
    <div className={`flex-1 flex flex-col items-center justify-center gap-6 p-8 ${
      theme === 'dark' ? 'bg-[#0f0f20]' : 'bg-gray-50'
    }`}>
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
        theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'
      }`}>
        <FileText size={36} className="text-blue-400" />
      </div>

      <div className="text-center max-w-sm">
        <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Редактор сценариев
        </h2>
        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          Профессиональный редактор с автоформатированием, авто-парсингом сцен, персонажей и локаций.
          Этот модуль сейчас в разработке.
        </p>
      </div>

      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm ${
        theme === 'dark'
          ? 'bg-white/5 border border-white/10 text-gray-500'
          : 'bg-gray-100 border border-gray-200 text-gray-400'
      }`}>
        <Clock size={14} />
        <span>Модуль будет доступен в следующей итерации</span>
      </div>
    </div>
  )
}
