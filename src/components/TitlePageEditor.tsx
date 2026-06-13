import { useState } from 'react'
import { Eye, EyeOff, Calendar, User, Mail, Phone, FileText, Tag } from 'lucide-react'

import type { TitlePage } from '../store/scriptStore'

interface TitlePageEditorProps {
  isDark: boolean
  data: TitlePage
  onChange: (data: TitlePage) => void
}

export default function TitlePageEditor({ isDark, data, onChange }: TitlePageEditorProps) {
  const [showPreview, setShowPreview] = useState(true)

  const bg = isDark ? '#0f0f20' : '#f5f5f5'
  const cardBg = isDark ? '#13132a' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#f1f5f9' : '#111827'
  const textSecondary = isDark ? '#6b7280' : '#9ca3af'

  const handleChange = (field: keyof TitlePage, value: string) => {
    onChange({ ...data, [field]: value })
  }

  return (
    <div className="flex-1 flex overflow-hidden" style={{ background: bg }}>
      {/* Левая панель - форма */}
      <div className="w-80 flex flex-col border-r overflow-y-auto"
        style={{ background: cardBg, borderColor: border }}>
        
        <div className="p-4 border-b" style={{ borderColor: border }}>
          <h2 className="text-sm font-bold" style={{ color: textPrimary }}>
            Титульная страница
          </h2>
          <p className="text-xs mt-1" style={{ color: textSecondary }}>
            Заполните данные для экспорта PDF
          </p>
        </div>

        <div className="p-4 space-y-4">
          {/* Название фильма */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: textSecondary }}>
              <FileText size={12} />
              Название фильма *
            </label>
            <input
              type="text"
              value={data.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm outline-none transition-all border ${isDark ? 'bg-white/5 border-white/10 hover:border-indigo-400 focus:border-indigo-400' : 'bg-gray-100 border-gray-300 hover:border-indigo-400 focus:border-indigo-400'} ${isDark ? 'text-white' : 'text-gray-900'}`}
              placeholder="Введите название"
            />
          </div>

          {/* Автор сценария */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: textSecondary }}>
              <User size={12} />
              Автор сценария *
            </label>
            <input
              type="text"
              value={data.writtenBy}
              onChange={(e) => handleChange('writtenBy', e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm outline-none transition-all border ${isDark ? 'bg-white/5 border-white/10 hover:border-indigo-400 focus:border-indigo-400' : 'bg-gray-100 border-gray-300 hover:border-indigo-400 focus:border-indigo-400'} ${isDark ? 'text-white' : 'text-gray-900'}`}
              placeholder="Иван Иванов"
            />
          </div>

          {/* По мотивам */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: textSecondary }}>
              <Tag size={12} />
              По мотивам (опционально)
            </label>
            <input
              type="text"
              value={data.basedOn}
              onChange={(e) => handleChange('basedOn', e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm outline-none transition-all border ${isDark ? 'bg-white/5 border-white/10 hover:border-indigo-400 focus:border-indigo-400' : 'bg-gray-100 border-gray-300 hover:border-indigo-400 focus:border-indigo-400'} ${isDark ? 'text-white' : 'text-gray-900'}`}
              placeholder="Название книги или истории"
            />
          </div>

          {/* Режиссёр */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: textSecondary }}>
              <User size={12} />
              Режиссёр-постановщик (опционально)
            </label>
            <input
              type="text"
              value={data.director}
              onChange={(e) => handleChange('director', e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm outline-none transition-all border ${isDark ? 'bg-white/5 border-white/10 hover:border-indigo-400 focus:border-indigo-400' : 'bg-gray-100 border-gray-300 hover:border-indigo-400 focus:border-indigo-400'} ${isDark ? 'text-white' : 'text-gray-900'}`}
              placeholder="Пётр Петров"
            />
          </div>

          {/* Контакты */}
          <div className="pt-2 border-t" style={{ borderColor: border }}>
            <label className="text-xs font-medium mb-3 block" style={{ color: textSecondary }}>
              Контакты (опционально)
            </label>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail size={14} style={{ color: textSecondary }} />
                <input
                  type="email"
                  value={data.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-all border ${isDark ? 'bg-white/5 border-white/10 hover:border-indigo-400 focus:border-indigo-400' : 'bg-gray-100 border-gray-300 hover:border-indigo-400 focus:border-indigo-400'} ${isDark ? 'text-white' : 'text-gray-900'}`}
                  placeholder="email@example.com"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Phone size={14} style={{ color: textSecondary }} />
                <input
                  type="tel"
                  value={data.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-all border ${isDark ? 'bg-white/5 border-white/10 hover:border-indigo-400 focus:border-indigo-400' : 'bg-gray-100 border-gray-300 hover:border-indigo-400 focus:border-indigo-400'} ${isDark ? 'text-white' : 'text-gray-900'}`}
                  placeholder="+7 (999) 123-45-67"
                />
              </div>
            </div>
          </div>

          {/* Драфт и дата */}
          <div className="pt-2 border-t flex gap-3" style={{ borderColor: border }}>
            <div className="flex-1">
              <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: textSecondary }}>
                <Tag size={12} />
                Драфт
              </label>
              <input
                type="text"
                value={data.draftNumber}
                onChange={(e) => handleChange('draftNumber', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm outline-none transition-all border ${isDark ? 'bg-white/5 border-white/10 hover:border-indigo-400 focus:border-indigo-400' : 'bg-gray-100 border-gray-300 hover:border-indigo-400 focus:border-indigo-400'} ${isDark ? 'text-white' : 'text-gray-900'}`}
                placeholder="1"
              />
            </div>
            <div className="flex-1">
              <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: textSecondary }}>
                <Calendar size={12} />
                Дата
              </label>
              <input
                type="text"
                value={data.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm outline-none transition-all border ${isDark ? 'bg-white/5 border-white/10 hover:border-indigo-400 focus:border-indigo-400' : 'bg-gray-100 border-gray-300 hover:border-indigo-400 focus:border-indigo-400'} ${isDark ? 'text-white' : 'text-gray-900'}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Правая панель - предпросмотр */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Шапка предпросмотра */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b"
          style={{ background: cardBg, borderColor: border }}>
          <span className="text-sm font-medium" style={{ color: textPrimary }}>
            Предпросмотр
          </span>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0',
              color: textSecondary,
            }}
          >
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPreview ? 'Скрыть' : 'Показать'}
          </button>
        </div>

        {/* Область предпросмотра */}
        {showPreview && (
          <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center" style={{ background: isDark ? '#0a0a15' : '#e5e5e5' }}>
            <div 
              className="w-full max-w-2xl min-h-[800px] p-12 rounded-xl shadow-2xl"
              style={{ 
                background: '#ffffff',
                color: '#000000',
                fontFamily: 'Courier New, monospace',
                boxShadow: isDark 
                  ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' 
                  : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
            >
              {/* Титульная страница - российский формат */}
              <div className="h-full flex flex-col">
                {/* Верхняя часть - пустое пространство */}
                <div className="flex-1" />
                
                {/* Центр - название */}
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold uppercase tracking-wide mb-8">
                    {data.title || 'НАЗВАНИЕ ФИЛЬМА'}
                  </h1>
                  
                  {data.basedOn && (
                    <p className="text-sm mb-4">
                      по мотивам «{data.basedOn}»
                    </p>
                  )}
                  
                  <div className="mt-8 space-y-2">
                    <p className="text-sm">автор сценария</p>
                    <p className="text-lg font-bold">
                      {data.writtenBy || 'АВТОР'}
                    </p>
                  </div>
                  
                  {data.director && (
                    <div className="mt-6 space-y-2">
                      <p className="text-sm">режиссёр-постановщик</p>
                      <p className="text-lg font-bold">{data.director}</p>
                    </div>
                  )}
                </div>
                
                {/* Низ - контакты и дата */}
                <div className="flex-1 flex flex-col justify-end">
                  {(data.email || data.phone) && (
                    <div className="text-center mb-4">
                      <p className="text-xs mb-1">контакты:</p>
                      {data.email && <p className="text-sm">{data.email}</p>}
                      {data.phone && <p className="text-sm">{data.phone}</p>}
                    </div>
                  )}
                  
                  <div className="text-center mt-4">
                    <p className="text-xs">
                      Драфт {data.draftNumber} · {data.date}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
