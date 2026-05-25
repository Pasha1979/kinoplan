import ComingSoonPage from '../Preproduction/ComingSoonPage'

export default function CastingPage() {
  return (
    <ComingSoonPage
      icon="🎭"
      title="Кастинг"
      description="Роли из сценария, кандидаты, пробы, утверждение актёров"
      phase="Фаза 2 — в разработке"
      accentColor="#f472b6"
      features={[
        'Список ролей, извлечённых из сценария',
        'Кандидаты на каждую роль с фото и портфолио',
        'Статус: на рассмотрении / пробы / утверждён / отказ',
        'Расписание проб с интеграцией в Calendar View',
        'DOOD — занятость актёров по съёмочным дням',
        'Договоры и контакты агентов',
      ]}
    />
  )
}
