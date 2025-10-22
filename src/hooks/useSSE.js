import { useEffect, useRef, useCallback } from 'react'

export function useSSE(url, onMessage) {
  const eventSourceRef = useRef(null)
  const onMessageRef = useRef(onMessage)
  const isConnectedRef = useRef(false)

  // Обновляем ref при изменении callback
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (!url || isConnectedRef.current) return

    try {
      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource
      isConnectedRef.current = true

      eventSource.addEventListener('subscribers', (event) => {
        try {
          const data = JSON.parse(event.data)
          onMessageRef.current('subscribers', data)
        } catch (err) {
          console.error('Ошибка парсинга SSE данных:', err)
        }
      })

      eventSource.addEventListener('error', () => {
        // Не логируем каждую ошибку, только закрываем соединение
        if (eventSource.readyState === EventSource.CLOSED) {
          isConnectedRef.current = false
        }
      })

      return () => {
        eventSource.close()
        isConnectedRef.current = false
      }
    } catch (err) {
      console.error('Ошибка создания SSE соединения:', err)
      isConnectedRef.current = false
    }
  }, [url])

  return eventSourceRef.current
}