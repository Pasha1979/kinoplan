import ComingSoonPage from '../Preproduction/ComingSoonPage'

export default function CallsheetsPage() {
  return (
    <ComingSoonPage
      icon="📋"
      title="Вызывные листы"
      description="Ежедневные вызывные листы с расписанием смены, составом группы и логистикой"
      phase="Фаза 2 — в разработке"
      accentColor="#4ade80"
      features={[
        'Создание вызывного из стрипборда одним кликом',
        'Состав смены: актёры, массовка, съёмочная группа',
        'Расписание дня: сцены, время, локации',
        'Логистика: транспорт, проживание, питание',
        'Рассылка по email и мессенджерам',
        'Подтверждения от участников (read receipt)',
      ]}
    />
  )
}
