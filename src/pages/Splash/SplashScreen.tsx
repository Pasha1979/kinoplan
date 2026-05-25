import { useEffect, useState } from 'react'

interface SplashScreenProps {
  onFinish: () => void
}

// Фазы заставки:
// 1. 'dark'      — полностью тёмный экран (0–400ms)
// 2. 'screen-in' — экран кинотеатра появляется (400–900ms)
// 3. 'logo-in'   — на экране плавно появляется логотип (900–1800ms)
// 4. 'loading'   — идёт полоса загрузки (1800–3200ms)
// 5. 'fade-out'  — всё гаснет (3200–3800ms)
type Phase = 'dark' | 'screen-in' | 'logo-in' | 'loading' | 'fade-out'

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [phase, setPhase] = useState<Phase>('dark')
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('screen-in'), 400),
      setTimeout(() => setPhase('logo-in'),   900),
      setTimeout(() => setPhase('loading'),   1600),
      setTimeout(() => setPhase('fade-out'),  3400),
      setTimeout(() => { setVisible(false); onFinish() }, 4000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [onFinish])

  if (!visible) return null

  const isFading = phase === 'fade-out'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{
        background: '#050508',
        opacity: isFading ? 0 : 1,
        transition: isFading ? 'opacity 0.7s ease' : 'none',
      }}
    >
      {/* Зал кинотеатра — радиальный градиент снизу (свет от экрана) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 40% at 50% 100%, rgba(255,220,150,0.06) 0%, transparent 70%)',
          opacity: phase === 'dark' ? 0 : 1,
          transition: 'opacity 0.8s ease',
        }}
      />

      {/* Ряды кресел — декоративная подсказка «зал» */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(10,10,20,0.9) 0%, transparent 100%)',
          opacity: phase === 'dark' ? 0 : 1,
          transition: 'opacity 1s ease',
        }}
      />

      {/* ЭКРАН КИНОТЕАТРА */}
      <div
        className="relative flex flex-col items-center justify-center"
        style={{
          width:  'min(720px, 88vw)',
          height: 'min(405px, 50vw)',
          // Экран появляется из центра
          transform: phase === 'dark' ? 'scaleX(0.05) scaleY(0.05)' : 'scaleX(1) scaleY(1)',
          opacity:   phase === 'dark' ? 0 : 1,
          transition: 'transform 0.6s cubic-bezier(0.22,1,0.36,1), opacity 0.5s ease',
          // Сам экран — светлая рамка + тёмное полотно
          borderRadius: '4px',
          border: '3px solid rgba(255,255,255,0.12)',
          boxShadow: [
            '0 0 0 1px rgba(255,255,255,0.05)',
            '0 0 60px rgba(255,200,100,0.08)',
            '0 0 120px rgba(255,150,50,0.05)',
            'inset 0 0 80px rgba(0,0,0,0.6)',
          ].join(', '),
          background: 'linear-gradient(160deg, #0e0e1c 0%, #080810 100%)',
        }}
      >
        {/* Блики на экране — верхний и боковые */}
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)' }}
        />
        <div
          className="absolute inset-y-0 left-0 w-px pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.08), transparent)' }}
        />

        {/* ЗЕРНИСТОСТЬ ПЛЕНКИ — SVG-шум поверх всего экрана */}
        {(phase === 'logo-in' || phase === 'loading') && (
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden rounded-sm"
            style={{ zIndex: 10, mixBlendMode: 'overlay', opacity: 0.25 }}
          >
            <svg
              className="absolute"
              style={{
                width: '200%', height: '200%', top: '-50%', left: '-50%',
                animation: 'filmGrain 0.08s steps(1) infinite',
              }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <filter id="grain">
                <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
              </filter>
              <rect width="100%" height="100%" filter="url(#grain)" opacity="0.5" />
            </svg>
          </div>
        )}

        {/* ЦАРАПИНА НА ПЛЕНКЕ */}
        {(phase === 'logo-in' || phase === 'loading') && (
          <div
            className="absolute inset-y-0 w-px pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.7) 20%, rgba(255,255,255,0.3) 50%, transparent 100%)',
              animation: 'filmScratch 2s ease-in-out infinite',
              zIndex: 11,
            }}
          />
        )}

        {/* ПОЛОСА ПРОКРУТКИ КАДРА */}
        {phase === 'logo-in' && (
          <div
            className="absolute inset-x-0 pointer-events-none"
            style={{
              height: '6px',
              background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.15), transparent)',
              animation: 'filmRoll 0.6s ease-out forwards',
              zIndex: 12,
            }}
          />
        )}

        {/* КОНТЕНТ НА ЭКРАНЕ — с эффектом мерцания и дёргания */}
        <div
          className={phase === 'logo-in' ? 'film-jitter' : ''}
          style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
        >
          <div
            className={`flex flex-col items-center gap-5 px-8 ${phase === 'logo-in' || phase === 'loading' ? 'film-flicker' : ''}`}
            style={{
              opacity:   phase === 'logo-in' || phase === 'loading' ? undefined : 0,
              transition: 'opacity 0.3s ease',
              // После мерцания — стабильно
              animationFillMode: 'forwards',
            }}
          >
            {/* Иконка */}
            <div className="relative">
              <div
                className="absolute inset-0 rounded-2xl blur-2xl"
                style={{ background: 'rgba(249,115,22,0.3)', transform: 'scale(1.6)' }}
              />
              <div
                className="relative w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl"
                style={{ background: 'linear-gradient(135deg, #f97316, #dc2626)' }}
              >
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
                  stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="13" height="10" rx="2" />
                  <path d="M17 9l4-2v10l-4-2V9z" />
                  <circle cx="7" cy="12" r="1.5" fill="white" stroke="none" />
                </svg>
              </div>
            </div>

            {/* Название */}
            <div className="text-center">
              <h1
                className="text-5xl font-bold text-white tracking-tight"
                style={{ textShadow: '0 0 40px rgba(249,115,22,0.4)' }}
              >
                КиноПлан
              </h1>
              <p className="text-xs text-gray-500 tracking-widest uppercase mt-2">
                Профессиональный инструмент кинопроизводства
              </p>
            </div>

            {/* Полоса загрузки */}
            <div
              className="w-52 h-px rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #f97316, #dc2626)',
                  width: phase === 'loading' ? '100%' : '0%',
                  transition: phase === 'loading' ? 'width 1.6s ease-in-out' : 'none',
                  boxShadow: '0 0 8px rgba(249,115,22,0.6)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Рамка вокруг экрана — имитация стены кинотеатра */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 120px rgba(0,0,0,0.8)',
          opacity: phase === 'dark' ? 0 : 1,
          transition: 'opacity 1s ease',
        }}
      />
    </div>
  )
}
