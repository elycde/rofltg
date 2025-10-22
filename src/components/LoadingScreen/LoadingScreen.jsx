import { useState, useEffect } from 'react'
import './LoadingScreen.css'

const LOADER_PHRASES = [
  'Ищу хост…',
  'Настраиваю соединение…',
  'Проверяю сеть…',
  'Подключаюсь к серверу…',
  'Загружаю модули…',
  'Подбираю ключи…',
  'Мдааа....',
  'Оптимизирую потоки…'
]

function LoadingScreen({ isVisible }) {
  const [currentPhrase, setCurrentPhrase] = useState(LOADER_PHRASES[0])

  useEffect(() => {
    if (!isVisible) return

    const interval = setInterval(() => {
      setCurrentPhrase(LOADER_PHRASES[Math.floor(Math.random() * LOADER_PHRASES.length)])
    }, 800 + Math.floor(Math.random() * 800))

    return () => clearInterval(interval)
  }, [isVisible])

  return (
    <div className={`loader ${!isVisible ? 'hidden' : ''}`}>
      <div className="loader-inner">
        <div className="ripple-wrapper" aria-hidden="true">
          <div className="ripple r1"></div>
          <div className="ripple r2"></div>
          <div className="ripple r3"></div>
          <div className="ripple-core" aria-hidden="true"></div>
        </div>
        <div className="loader-text">{currentPhrase}</div>
      </div>
    </div>
  )
}

export default LoadingScreen