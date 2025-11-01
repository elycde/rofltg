import { useState, useEffect } from 'react'
import LoadingScreen from './components/LoadingScreen/LoadingScreen'
import Header from './components/Header/Header'
import VideoSlider from './components/VideoSlider/VideoSlider'
import SnowEffect from './components/SnowEffect/SnowEffect'
import FloatingPosts from './components/FloatingPosts/FloatingPosts'
import { useChannelData } from './hooks/useChannelData'
import { useTitleAnimation } from './hooks/useTitleAnimation'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [componentsLoaded, setComponentsLoaded] = useState(false)
  const { channelData, isLoadingChannel } = useChannelData()
  
  useTitleAnimation()

  // Проверка загрузки всех компонентов
  useEffect(() => {
    const checkAllLoaded = () => {
      // Минимальное время загрузки
      const minLoadTime = new Promise(resolve => setTimeout(resolve, 1500))
      
      // Ждем загрузки данных канала
      const dataLoaded = new Promise(resolve => {
        if (!isLoadingChannel) {
          resolve()
        } else {
          const interval = setInterval(() => {
            if (!isLoadingChannel) {
              clearInterval(interval)
              resolve()
            }
          }, 100)
        }
      })

      Promise.all([minLoadTime, dataLoaded]).then(() => {
        setComponentsLoaded(true)
        setTimeout(() => setIsLoading(false), 300)
      })
    }

    checkAllLoaded()
  }, [isLoadingChannel])

  return (
    <>
      <LoadingScreen isVisible={isLoading} />
      <SnowEffect />
      <FloatingPosts />
      
      {/* Аврора фон */}
      <div className="aurora">
        <span className="a1"></span>
        <span className="a2"></span>
        <span className="a3"></span>
      </div>

      <div className="container">
        <main className="card">
          <Header channelData={channelData} isLoading={isLoadingChannel} />
        </main>

        <VideoSlider />
      </div>

      <footer className="page-footer">
        <div className="page-footer-content">
          Автор: <a href="https://t.me/kakakflpw" target="_blank" rel="noopener noreferrer">@kakakflpw</a>
        </div>
      </footer>
    </>
  )
}

export default App