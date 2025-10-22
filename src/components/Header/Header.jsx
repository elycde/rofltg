import { useEffect, useState } from 'react'
import { useSSE } from '../../hooks/useSSE'

function Header({ channelData, isLoading }) {
  const [liveData, setLiveData] = useState(null)
  const [shouldBump, setShouldBump] = useState(false)
  const [imageError, setImageError] = useState(false)

  // Сброс ошибки при получении новых данных
  useEffect(() => {
    if (channelData) {
      setImageError(false)
    }
  }, [channelData])

  // SSE для live обновлений
  useSSE('/api/stream', (eventType, data) => {
    if (eventType === 'subscribers') {
      const prevSubs = liveData?.subscribers
      setLiveData(data)

      // Анимация bump при изменении
      if (prevSubs && prevSubs !== data.subscribers) {
        setShouldBump(true)
        setTimeout(() => setShouldBump(false), 400)
      }
    }
  })

  // Умное объединение данных - берем фото из channelData, а статистику из liveData
  const displayData = {
    title: channelData?.title || 'fromoldnuke7',
    username: channelData?.username || 'fromoldnuke7',
    photo: channelData?.photo || `https://t.me/i/userpic/320/${channelData?.username || 'fromoldnuke7'}.jpg`,
    subscribers: liveData?.subscribers ?? channelData?.subscribers ?? null,
    delta24h: liveData?.delta24h ?? channelData?.delta24h ?? null,
    delta7d: liveData?.delta7d ?? channelData?.delta7d ?? null
  }

  // Обработчик ошибки загрузки изображения
  const handleImageError = () => {
    setImageError(true)
  }

  // Обработчик успешной загрузки изображения
  const handleImageLoad = () => {
    setImageError(false)
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('ru-RU').format(num)
  }

  const formatDelta = (delta) => {
    return (delta > 0 ? '+' : '') + formatNumber(delta)
  }

  if (isLoading && !channelData) {
    return (
      <section className="header">
        <div className="avatar">
          <div className="avatar-placeholder">FN7</div>
        </div>
        <div>
          <h1 className="title">Загрузка…</h1>
          <p className="subtitle">Актуальный Telegram канал</p>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="header">
        <div className="avatar">
          <div className="avatar-placeholder">
            {displayData.title ? displayData.title.charAt(0).toUpperCase() : 'FN7'}
          </div>
          {displayData.photo && (
            <img
              src={displayData.photo}
              alt={`Аватар ${displayData.title}`}
              onError={handleImageError}
              onLoad={handleImageLoad}
              style={{ display: imageError ? 'none' : 'block' }}
            />
          )}
        </div>
        <div>
          <h1 className="title">{displayData.title}</h1>
          <p className="subtitle">Актуальный Telegram канал</p>
        </div>
      </section>

      {displayData && (
        <div className="stats-wrap">
          {typeof displayData.subscribers === 'number' && (
            <div className={`badge ${shouldBump ? 'bump' : ''}`}>
              <span className="dot"></span>
              <span>{formatNumber(displayData.subscribers)} подписчиков</span>
            </div>
          )}

          {(typeof displayData.delta24h === 'number' || typeof displayData.delta7d === 'number') && (
            <div className="metrics">
              {typeof displayData.delta24h === 'number' && (
                <div className="metric">24ч: {formatDelta(displayData.delta24h)}</div>
              )}
              {typeof displayData.delta7d === 'number' && (
                <div className="metric">7д: {formatDelta(displayData.delta7d)}</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="actions">
        <a
          className="button blue"
          href={displayData?.username ? `https://t.me/${displayData.username}` : '#'}
          target="_blank"
          rel="noopener noreferrer"
        >
          Перейти в канал
        </a>
        <a
          className="button youtube"
          href="https://www.youtube.com/@Fromoldnukee2"
          target="_blank"
          rel="noopener noreferrer"
        >
          YouTube
        </a>
      </div>
    </>
  )
}

export default Header