/** Разработка проекта: персонажи, локации, синопсис — живёт на уровне проекта */

export type DevCharacterType = 'main' | 'secondary' | 'episodic' | 'stock'

/** Тип отношения между персонажами */
export type DevRelationType = 'ally' | 'antagonist' | 'family' | 'love' | 'friend' | 'enemy' | 'colleague' | 'boss' | 'mentor' | 'rival' | 'other'

/** Отношение персонажа к другому персонажу библии */
export interface DevRelationship {
  id: string
  type: DevRelationType
  /** id целевого персонажа из библии */
  targetId: string
  /** комментарий к связи (например «старший брат») */
  note?: string
}

export interface DevCharacter {
  id: string
  /** Имя персонажа — капслок, как в тексте (ИВАН, АННА-МАРИЯ) */
  name: string
  /** Тип персонажа */
  type: DevCharacterType
  /** Описание: кто он, драматическая функция */
  description?: string
  /** Арка: откуда → куда меняется */
  arc?: string
  /** Персонаж «на серию» — номер серии, иначе общий на проект */
  episodeTag?: number
  /** ID сцен, где персонаж реально появляется (авто-привязка из текста) */
  sceneIds?: string[]
  /** Ручной порядок при сортировке «драг» */
  order?: number
  /** Возраст персонажа */
  age?: string
  /** Профессия/род занятий */
  profession?: string
  /** Внешность — для кастинга */
  appearance?: string
  /** Характер/темперамент */
  temperament?: string
  /** Прототип / референс (реальный человек, актёр) */
  prototype?: string
  /** Желание/цель персонажа */
  desire?: string
  /** Страх/слабость */
  fear?: string
  /** Секрет — что скрывает */
  secret?: string
  /** Центральный конфликт персонажа */
  conflict?: string
  /** Отношения с другими персонажами библии */
  relationships?: DevRelationship[]
}

export interface DevLocation {
  id: string
  /** Название локации — как в шапках (КВАРТИРА ИВАНА, УЛИЦА ПУШКИНА) */
  name: string
  /** Описание локации */
  description?: string
  /** ID сцен, где локация встречается (авто-привязка) */
  sceneIds?: string[]
  /** Ручной порядок при сортировке «драг» */
  order?: number
  /** Атмосфера/тон локации */
  atmosphere?: string
  /** Ключевой реквизит в сценах */
  props?: string
}

export interface DevSynopsis {
  /** Логлайн — 1 предложение: герой + желание + препятствие */
  logline?: string
  /** Синопсис — абзац */
  synopsis?: string
  /** Полный текст разработки — свободные заметки */
  notes?: string
}

/** Папка-контейнер для группировки персонажей/локаций (как группы в «Карточках») */
export interface DevFolder {
  id: string
  name: string
  color: string
  /** 'chars' | 'locs' — для какой под-вкладки папка */
  kind: 'chars' | 'locs'
  /** ID элементов внутри папки */
  itemIds: string[]
  collapsed?: boolean
}

export interface ProjectDevelopment {
  characters: DevCharacter[]
  locations: DevLocation[]
  synopsis: DevSynopsis
  /** Папки персонажей и локаций */
  folders?: DevFolder[]
}
