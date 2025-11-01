'use client'

import { useState, useEffect } from 'react'
import LoadingScreen from '../src/components/LoadingScreen/LoadingScreen'
import Header from '../src/components/Header/Header'
import VideoSlider from '../src/components/VideoSlider/VideoSlider'
import SnowEffect from '../src/components/SnowEffect/SnowEffect'
import FloatingPosts from '../src/components/FloatingPosts/FloatingPosts'
import { useChannelData } from '../src/hooks/useChannelData'
import { useTitleAnimation } from '../src/hooks/useTitleAnimation'

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)
  const [componentsLoaded, setComponentsLoaded] = useState(false)
  const { channelData, isLoadingChannel } = useChannelData()
  
  useTitleAnimation()

  useEffect(() => {
    const checkAllLoaded = () => {
      const minLoadTime = new Promise(resolve => setTimeout(resolve, 1500))
      
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
