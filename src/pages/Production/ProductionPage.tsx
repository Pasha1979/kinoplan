import ComingSoonPage from '../Preproduction/ComingSoonPage'

export default function ProductionPage() {
  return (
    <ComingSoonPage
      icon="🎬"
      title="Съёмочный день"
      description="Оперативное управление съёмочным днём: хронометраж, отставание, сцены"
      phase="Фаза 3 — в разработке"
      accentColor="#fb923c"
      features={[
        'Таймер съёмочного дня — план vs факт',
        'Галочки по сценам: снято / не снято / перенос',
        'Выработка минут экранного времени в день',
        'Производственный рапорт по итогам смены',
        'Отставание от КПП — автоматический пересчёт',
        'Связь с явочным листом и вызывным',
      ]}
    />
  )
}
