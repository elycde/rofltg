import { useEffect } from 'react'

const TITLES = ["NeverLose", "UMBRELLA", "Skeet", "fromoldnuke7", "Kakakflpw", "MORIARTY", "MELLSTROY", "САНЯ ГЕЙ"]
const SYMBOLS = "0123456789№%?*e19fef04-dd37-4d98-8b09-493328795396#@!"

export function useTitleAnimation() {
  useEffect(() => {
    let currentIndex = 0

    const animateTitle = (text) => {
      return new Promise(resolve => {
        let output = Array(text.length).fill("")
        let step = 0

        const interval = setInterval(() => {
          let done = true
          
          for (let i = 0; i < text.length; i++) {
            if (step < i * 2 + 5) {
              output[i] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
              done = false
            } else {
              output[i] = text[i]
            }
          }
          
          document.title = output.join("")
          
          if (done) {
            clearInterval(interval)
            setTimeout(resolve, 1200) // пауза перед следующим словом
          }
          
          step++
        }, 80)
      })
    }

    const loopTitles = async () => {
      while (true) {
        const text = TITLES[currentIndex % TITLES.length]
        await animateTitle(text)
        currentIndex++
      }
    }

    loopTitles()

    // Cleanup не нужен, так как это бесконечный цикл
  }, [])
}