import { useState, useEffect } from 'react'

export function useChannelData() {
  const [channelData, setChannelData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchChannelData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/channel')
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        setChannelData(data)
        setError(null)
      } catch (err) {
        console.error('Ошибка загрузки данных канала:', err)
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchChannelData()
  }, [])

  return { channelData, isLoading, error }
}