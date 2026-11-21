import { useEffect } from 'react'

/** Deep-link в справку: openHelp('text', 'smarttype') из любого места приложения.
 *  Модалка открывается на нужной странице и прокручивается к якорю. */

export interface HelpRequest {
  pageId: string
  anchor?: string
}

export const HELP_EVENT = 'kinoplan:open-help'

export function openHelp(pageId: string, anchor?: string) {
  window.dispatchEvent(
    new CustomEvent<HelpRequest>(HELP_EVENT, { detail: { pageId, anchor } }),
  )
}

/** Подписка страницы на запросы открытия справки */
export function useHelpRequest(handler: (req: HelpRequest) => void) {
  useEffect(() => {
    const on = (e: Event) => handler((e as CustomEvent<HelpRequest>).detail)
    window.addEventListener(HELP_EVENT, on)
    return () => window.removeEventListener(HELP_EVENT, on)
  }, [handler])
}
