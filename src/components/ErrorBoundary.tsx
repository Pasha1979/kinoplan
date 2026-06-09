import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertOctagon, RefreshCw, Trash2, Copy, Check } from 'lucide-react'

interface Props {
  children?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, copied: false }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    })
    console.error('Uncaught error:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    })
    window.location.reload()
  }

  private handleClearStorage = () => {
    if (confirm('Вы уверены, что хотите сбросить все данные приложения? Это удалит все проекты и черновики сценариев!')) {
      localStorage.clear()
      window.location.reload()
    }
  }

  private handleCopyError = () => {
    const { error, errorInfo } = this.state
    const text = `Error: ${error?.message}\n\nStack:\n${error?.stack}\n\nComponent Stack:\n${errorInfo?.componentStack}`
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d0d1a] text-white flex flex-col items-center justify-center p-6 font-sans selection:bg-red-500/30">
          <div className="max-w-xl w-full bg-[#161630] border border-red-500/20 rounded-2xl p-8 shadow-2xl flex flex-col gap-6 animate-in fade-in duration-500">
            
            {/* Иконка и Заголовок */}
            <div className="flex items-center gap-4 border-b border-white/5 pb-4">
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500">
                <AlertOctagon size={28} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-red-400">Что-то пошло не так</h1>
                <p className="text-xs text-gray-400 mt-1">Произошла непредвиденная ошибка в интерфейсе приложения.</p>
              </div>
            </div>

            {/* Описание ошибки */}
            <div className="bg-[#0f0f20] border border-white/5 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-300">
                {this.state.error?.name || 'Error'}: {this.state.error?.message || 'Неизвестная ошибка'}
              </p>
              {this.state.error?.stack && (
                <div className="mt-3 text-xs font-mono text-gray-500 overflow-auto max-h-32 leading-relaxed whitespace-pre bg-black/20 p-2.5 rounded-lg border border-white/5">
                  {this.state.error.stack}
                </div>
              )}
            </div>

            {/* Кнопки действий */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/10 active:scale-95"
              >
                <RefreshCw size={16} />
                Перезагрузить страницу
              </button>

              <button
                onClick={this.handleCopyError}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 font-medium text-sm px-4 py-2.5 rounded-xl transition-all border border-white/5 active:scale-95"
              >
                {this.state.copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                {this.state.copied ? 'Скопировано!' : 'Копировать лог'}
              </button>

              <button
                onClick={this.handleClearStorage}
                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium text-sm px-4 py-2.5 rounded-xl transition-all border border-red-500/10 active:scale-95 ml-auto"
                title="Очистит localStorage и кэш приложения"
              >
                <Trash2 size={16} />
                Сбросить кэш
              </button>
            </div>

          </div>
        </div>
      )
    }

    return this.props.children
  }
}
