import { useEffect, useRef } from 'react'

function SnowEffect() {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const flakesRef = useRef([])
  const lastTimeRef = useRef(performance.now())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let w = 0, h = 0, ratio = 1
    const config = { density: 0.0005, maxSize: 3.2, speed: 0.6, wind: 0.2 }

    const resize = () => {
      ratio = window.devicePixelRatio || 1
      w = Math.max(320, window.innerWidth)
      h = Math.max(200, window.innerHeight)
      canvas.width = Math.floor(w * ratio)
      canvas.height = Math.floor(h * ratio)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

      const targetCount = Math.ceil(w * h * config.density)
      const flakes = flakesRef.current

      while (flakes.length < targetCount) {
        flakes.push(makeFlake(true))
      }
      while (flakes.length > targetCount) {
        flakes.pop()
      }
    }

    const makeFlake = (init) => {
      const size = Math.random() * config.maxSize + 0.8
      return {
        x: Math.random() * w,
        y: init ? Math.random() * h : -10 - Math.random() * 50,
        vx: (Math.random() - 0.5) * config.wind,
        vy: size * (0.4 + Math.random() * config.speed),
        r: size,
        a: 0.8 + Math.random() * 0.2
      }
    }

    const step = (now) => {
      const dt = Math.min(40, now - lastTimeRef.current) / 1000
      lastTimeRef.current = now

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'

      const flakes = flakesRef.current
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i]
        f.x += f.vx * dt * 60
        f.y += f.vy * dt * 60
        f.vx += (Math.sin((now + i * 997) / 5000) * 0.02) * dt * 60

        if (f.y - f.r > h || f.x < -50 || f.x > w + 50) {
          flakes[i] = makeFlake(false)
          continue
        }

        ctx.globalAlpha = f.a
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalAlpha = 1
      animationRef.current = requestAnimationFrame(step)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = null
        }
      } else {
        lastTimeRef.current = performance.now()
        animationRef.current = requestAnimationFrame(step)
      }
    }

    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    resize()
    animationRef.current = requestAnimationFrame(step)

    return () => {
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return <canvas ref={canvasRef} className="snow-canvas" aria-hidden="true" />
}

export default SnowEffect