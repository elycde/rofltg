import { useState, useEffect, useRef, useMemo } from 'react'
import './VideoSlider.css'

const CHANNEL_HANDLE = 'Fromoldnukee2'
const MAX_VIDEOS = 50 // Максимум видео с канала
const AUTOPLAY_MS = 5000

function VideoSlider() {
    const [rawVideos, setRawVideos] = useState([]) // Все видео с сервера БЕЗ фильтрации
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const [currentPage, setCurrentPage] = useState(0)
    const [sortBy, setSortBy] = useState('date')
    const [sortOrder, setSortOrder] = useState('desc')
    const [showFilters, setShowFilters] = useState(false)
    const [autoplayEnabled, setAutoplayEnabled] = useState(true)
    const [filterSettings, setFilterSettings] = useState({
        excludeShorts: false, // По умолчанию показываем ВСЕ видео включая Shorts
        excludeKeywords: ['#shorts', '#short', 'shorts', 'short'] // ключевые слова для исключения
    })

    const trackRef = useRef(null)
    const autoplayTimerRef = useRef(null)
    const videosPerPage = 3

    // Функция фильтрации видео
    const applyFilters = (videoList) => {
        return videoList.filter(video => {
            const title = (video.title || '').toLowerCase()
            const description = (video.description || '').toLowerCase()

            // Проверяем исключение Shorts
            // Примечание: сервер загружает ВСЕ видео включая Shorts с разных вкладок канала
            if (filterSettings.excludeShorts) {
                // Проверяем флаг isShort от сервера
                if (video.isShort) {
                    return false
                }

                // Проверяем длительность (если <= 60 секунд, считаем Short)
                if (video.durationSeconds && video.durationSeconds <= 60) {
                    return false
                }

                // Проверяем ключевые слова в названии и описании
                const hasExcludedKeywords = filterSettings.excludeKeywords.some(keyword => {
                    const keywordLower = keyword.toLowerCase()
                    return title.includes(keywordLower) || description.includes(keywordLower)
                })
                
                if (hasExcludedKeywords) {
                    return false
                }

                // Дополнительная проверка на признаки Shorts в названии
                const shortsPatterns = [
                    /\bshorts?\b/i,
                    /\bshort\b/i,
                    /#shorts?/i,
                    /\bкороткое\b/i,
                    /\bкоротко\b/i
                ]
                
                const hasShortPattern = shortsPatterns.some(pattern => {
                    return pattern.test(title) || pattern.test(description)
                })
                
                if (hasShortPattern) {
                    return false
                }
            }

            return true
        })
    }

    // Загрузка видео (только один раз при монтировании)
    useEffect(() => {
        const loadVideos = async () => {
            try {
                setIsLoading(true)
                setError(null)
                
                // Добавляем небольшую задержку для анимации
                await new Promise(resolve => setTimeout(resolve, 300))
                
                // Делаем ДВА запроса параллельно: обычные видео + shorts
                const [videosResponse, shortsResponse] = await Promise.all([
                    fetch(`/api/videos?handle=${encodeURIComponent(CHANNEL_HANDLE)}&maxResults=${MAX_VIDEOS}`).catch(() => null),
                    fetch(`/api/shorts?handle=${encodeURIComponent(CHANNEL_HANDLE)}&maxResults=${MAX_VIDEOS}`).catch(() => null)
                ])

                let regularVideos = []
                let shortsVideos = []

                // Обрабатываем обычные видео
                if (videosResponse && videosResponse.ok) {
                    const data = await videosResponse.json()
                    regularVideos = data.items || []
                }

                // Обрабатываем Shorts
                if (shortsResponse && shortsResponse.ok) {
                    const data = await shortsResponse.json()
                    shortsVideos = data.items || []
                }

                // Объединяем видео, избегая дубликатов
                const seenIds = new Set()
                const allVideos = []

                // Сначала добавляем обычные видео
                regularVideos.forEach(video => {
                    if (!seenIds.has(video.id)) {
                        seenIds.add(video.id)
                        allVideos.push(video)
                    }
                })

                // Затем добавляем Shorts
                shortsVideos.forEach(video => {
                    if (!seenIds.has(video.id)) {
                        seenIds.add(video.id)
                        allVideos.push(video)
                    }
                })
                
                if (allVideos.length === 0) {
                    throw new Error('Не удалось загрузить видео с канала')
                }
                
                setRawVideos(allVideos)
            } catch (err) {
                setError(err.message)
            } finally {
                setIsLoading(false)
            }
        }

        loadVideos()
    }, []) // Загружаем только один раз

    // Функция для парсинга относительных дат
    const parseRelativeDate = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return new Date(0)
        
        const now = new Date()
        const str = dateStr.toLowerCase()
        
        // Парсим русские относительные даты
        if (str.includes('секунд') || str.includes('только что')) {
            return new Date(now.getTime() - 30 * 1000) // 30 секунд назад
        }
        if (str.includes('минут')) {
            const match = str.match(/(\d+)\s*мин/)
            const minutes = match ? parseInt(match[1]) : 1
            return new Date(now.getTime() - minutes * 60 * 1000)
        }
        if (str.includes('час')) {
            const match = str.match(/(\d+)\s*ч/)
            const hours = match ? parseInt(match[1]) : 1
            return new Date(now.getTime() - hours * 60 * 60 * 1000)
        }
        if (str.includes('день') || str.includes('дн.') || str.includes('вчера')) {
            if (str.includes('вчера')) return new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
            if (str.includes('позавчера')) return new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
            const match = str.match(/(\d+)\s*дн/)
            const days = match ? parseInt(match[1]) : 1
            return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
        }
        if (str.includes('недел')) {
            const match = str.match(/(\d+)\s*недел/)
            const weeks = match ? parseInt(match[1]) : 1
            return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000)
        }
        if (str.includes('месяц')) {
            const match = str.match(/(\d+)\s*месяц/)
            const months = match ? parseInt(match[1]) : 1
            return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000)
        }
        if (str.includes('год') || str.includes('лет')) {
            const match = str.match(/(\d+)\s*(год|лет)/)
            const years = match ? parseInt(match[1]) : 1
            return new Date(now.getTime() - years * 365 * 24 * 60 * 60 * 1000)
        }
        
        // Парсим английские относительные даты
        if (str.includes('second') && str.includes('ago')) {
            return new Date(now.getTime() - 30 * 1000)
        }
        if (str.includes('minute') && str.includes('ago')) {
            const match = str.match(/(\d+)\s*minute/)
            const minutes = match ? parseInt(match[1]) : 1
            return new Date(now.getTime() - minutes * 60 * 1000)
        }
        if (str.includes('hour') && str.includes('ago')) {
            const match = str.match(/(\d+)\s*hour/)
            const hours = match ? parseInt(match[1]) : 1
            return new Date(now.getTime() - hours * 60 * 60 * 1000)
        }
        if (str.includes('day') && str.includes('ago')) {
            const match = str.match(/(\d+)\s*day/)
            const days = match ? parseInt(match[1]) : 1
            return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
        }
        if (str.includes('week') && str.includes('ago')) {
            const match = str.match(/(\d+)\s*week/)
            const weeks = match ? parseInt(match[1]) : 1
            return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000)
        }
        if (str.includes('month') && str.includes('ago')) {
            const match = str.match(/(\d+)\s*month/)
            const months = match ? parseInt(match[1]) : 1
            return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000)
        }
        if (str.includes('year') && str.includes('ago')) {
            const match = str.match(/(\d+)\s*year/)
            const years = match ? parseInt(match[1]) : 1
            return new Date(now.getTime() - years * 365 * 24 * 60 * 60 * 1000)
        }
        
        // Пробуем стандартный парсинг даты
        const parsed = new Date(dateStr)
        return isNaN(parsed.getTime()) ? new Date(0) : parsed
    }

    // Мемоизированная фильтрация и сортировка видео
    const sortedVideos = useMemo(() => {
        if (rawVideos.length === 0) return []
        
        // Сначала применяем фильтрацию
        const filteredVideos = applyFilters(rawVideos)
        
        // Затем сортируем
        return [...filteredVideos].sort((a, b) => {
            let comparison = 0
            
            if (sortBy === 'views') {
                const aViews = parseInt(a.viewCount) || 0
                const bViews = parseInt(b.viewCount) || 0
                comparison = bViews - aViews
            } else {
                // Сортировка по дате
                const aDate = parseRelativeDate(a.publishedAt)
                const bDate = parseRelativeDate(b.publishedAt)
                comparison = bDate.getTime() - aDate.getTime()
            }
            
            // Применяем порядок сортировки
            return sortOrder === 'desc' ? comparison : -comparison
        })
    }, [rawVideos, sortBy, sortOrder, filterSettings]) // Добавляем filterSettings в зависимости

    const totalPages = Math.ceil(sortedVideos.length / videosPerPage)

    // Сброс на первую страницу при изменении сортировки или фильтров
    useEffect(() => {
        setCurrentPage(0)
        // Сбрасываем позицию трека
        if (trackRef.current) {
            trackRef.current.scrollTo({ left: 0, behavior: 'smooth' })
        }
    }, [sortBy, sortOrder, filterSettings])

    // Автоплей
    useEffect(() => {
        if (!autoplayEnabled || totalPages <= 1) {
            if (autoplayTimerRef.current) {
                clearInterval(autoplayTimerRef.current)
                autoplayTimerRef.current = null
            }
            return
        }

        if (autoplayTimerRef.current) {
            clearInterval(autoplayTimerRef.current)
        }

        autoplayTimerRef.current = setInterval(() => {
            setCurrentPage(prev => (prev + 1) % totalPages)
        }, AUTOPLAY_MS)

        return () => {
            if (autoplayTimerRef.current) {
                clearInterval(autoplayTimerRef.current)
                autoplayTimerRef.current = null
            }
        }
    }, [autoplayEnabled, totalPages])

    // Простой скролл трека
    useEffect(() => {
        if (!trackRef.current || totalPages <= 1) return

        const track = trackRef.current
        const itemWidth = 318 // ширина видео + gap
        const scrollPosition = currentPage * itemWidth * videosPerPage

        track.scrollTo({ 
            left: scrollPosition, 
            behavior: 'smooth' 
        })
    }, [currentPage, totalPages])

    const pauseAutoplay = () => {
        setAutoplayEnabled(false)
        setTimeout(() => setAutoplayEnabled(true), 8000)
    }

    const handlePrevious = () => {
        setCurrentPage(prev => Math.max(0, prev - 1))
        pauseAutoplay()
    }

    const handleNext = () => {
        setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))
        pauseAutoplay()
    }

    const handlePageClick = (pageIndex) => {
        setCurrentPage(pageIndex)
        pauseAutoplay()
    }

    const handleSortChange = (newSortBy, newSortOrder) => {
        setShowFilters(false)
        pauseAutoplay()
        
        // Добавляем анимацию при смене сортировки
        if (trackRef.current) {
            // Сначала добавляем класс для анимации
            trackRef.current.classList.add('sorting')
            
            // Используем requestAnimationFrame для гарантии что класс применился
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Меняем данные
                    setSortBy(newSortBy)
                    setSortOrder(newSortOrder)
                    
                    // Убираем класс после анимации
                    setTimeout(() => {
                        if (trackRef.current) {
                            trackRef.current.classList.remove('sorting')
                        }
                    }, 800)
                })
            })
        } else {
            setSortBy(newSortBy)
            setSortOrder(newSortOrder)
        }
    }

    const handleFilterChange = (newFilterSettings) => {
        setShowFilters(false)
        pauseAutoplay()
        
        // Добавляем анимацию при смене фильтров
        if (trackRef.current) {
            // Сначала добавляем класс для анимации
            trackRef.current.classList.add('filtering')
            
            // Используем requestAnimationFrame для гарантии что класс применился
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Меняем данные
                    setFilterSettings(prev => ({ ...prev, ...newFilterSettings }))
                    
                    // Убираем класс после анимации
                    setTimeout(() => {
                        if (trackRef.current) {
                            trackRef.current.classList.remove('filtering')
                        }
                    }, 800)
                })
            })
        } else {
            setFilterSettings(prev => ({ ...prev, ...newFilterSettings }))
        }
    }

    const formatDate = (dateStr) => {
        try {
            if (typeof dateStr === 'string' && dateStr.includes('ago')) {
                return translateEnglishDate(dateStr)
            }

            const d = new Date(dateStr)
            if (isNaN(d)) return translateEnglishDate(String(dateStr))

            const now = new Date()
            const diffMs = now - d
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

            if (diffHours < 1) return 'Только что'
            if (diffHours < 24) return `${diffHours} ч. назад`
            if (diffDays === 1) return 'Вчера'
            if (diffDays === 2) return 'Позавчера'
            if (diffDays < 7) return `${diffDays} дн. назад`

            const weeks = Math.floor(diffDays / 7)
            if (weeks === 1) return '1 неделю назад'
            if (weeks < 4) return `${weeks} нед. назад`

            const months = Math.floor(diffDays / 30)
            if (months === 1) return '1 месяц назад'
            if (months < 12) return `${months} мес. назад`

            const years = Math.floor(diffDays / 365)
            if (years === 1) return '1 год назад'
            return `${years} лет назад`
        } catch (e) {
            return translateEnglishDate(String(dateStr))
        }
    }

    const translateEnglishDate = (englishDate) => {
        if (!englishDate || typeof englishDate !== 'string') return ''

        const str = englishDate.toLowerCase()

        if (str.includes('second') && str.includes('ago')) return 'Только что'
        if (str.includes('minute') && str.includes('ago')) {
            const match = str.match(/(\d+)\s*minute/)
            const num = match ? match[1] : '1'
            return `${num} мин. назад`
        }
        if (str.includes('hour') && str.includes('ago')) {
            const match = str.match(/(\d+)\s*hour/)
            const num = match ? match[1] : '1'
            return `${num} ч. назад`
        }
        if (str.includes('day') && str.includes('ago')) {
            const match = str.match(/(\d+)\s*day/)
            const num = match ? match[1] : '1'
            if (num === '1') return 'Вчера'
            if (num === '2') return 'Позавчера'
            return `${num} дн. назад`
        }
        if (str.includes('week') && str.includes('ago')) {
            const match = str.match(/(\d+)\s*week/)
            const num = match ? match[1] : '1'
            if (num === '1') return '1 неделю назад'
            return `${num} нед. назад`
        }
        if (str.includes('month') && str.includes('ago')) {
            const match = str.match(/(\d+)\s*month/)
            const num = match ? match[1] : '1'
            if (num === '1') return '1 месяц назад'
            return `${num} мес. назад`
        }
        if (str.includes('year') && str.includes('ago')) {
            const match = str.match(/(\d+)\s*year/)
            const num = match ? match[1] : '1'
            if (num === '1') return '1 год назад'
            return `${num} лет назад`
        }

        return englishDate
    }

    const formatViews = (count) => {
        const num = parseInt(count) || 0
        if (num === 0) return '0 просм.'
        if (num < 1000) return `${num} просм.`
        if (num < 1000000) return `${Math.floor(num / 1000)}К просм.`
        if (num < 1000000000) return `${Math.floor(num / 1000000)}М просм.`
        return `${Math.floor(num / 1000000000)}Б просм.`
    }

    if (error) {
        return (
            <div className="video-strip-container">
                <div className="video-section-header">
                    <h2 className="video-section-title">Последние видео</h2>
                    <p className="video-section-subtitle">Свежий контент с YouTube канала</p>
                </div>
                <div className="vs-empty">
                    <div style={{ fontSize: '18px', marginBottom: '8px' }}>😔</div>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Не удалось загрузить видео</div>
                    <div style={{ fontSize: '14px', opacity: '0.7' }}>{error}</div>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="video-section-header">
                <h2 className="video-section-title">Последние видео</h2>
                <p className="video-section-subtitle">Свежий контент с YouTube канала</p>
            </div>

            <div className="video-strip-container">
                {rawVideos.length > 0 && (
                    <div className="video-controls">
                        <div className="video-filter-wrapper">
                            <button 
                                className={`filter-button glass-blur ${showFilters ? 'active' : ''} ${!filterSettings.excludeShorts ? 'has-active-filters' : ''}`}
                                onClick={() => setShowFilters(!showFilters)}
                                aria-label="Фильтры и сортировка"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M3 7h18M6 12h12M9 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                                <span className="filter-label">Фильтры</span>
                            </button>
                            {showFilters && (
                                <>
                                    <div className="filter-backdrop" onClick={() => setShowFilters(false)}></div>
                                    <div className="filter-dropdown glass-blur">
                                        <div className="filter-group">
                                            <div className="filter-group-title">Фильтрация контента</div>
                                            <button 
                                                className="filter-option disabled"
                                                disabled
                                                title="Функция в разработке"
                                            >
                                                <span className="filter-icon">○</span>
                                                Исключить Shorts
                                                <span className="filter-badge">В разработке</span>
                                            </button>
                                        </div>
                                        <div className="filter-divider"></div>
                                        <div className="filter-group">
                                            <div className="filter-group-title">Сортировка</div>
                                            <button 
                                                className={`filter-option ${sortBy === 'date' && sortOrder === 'desc' ? 'active' : ''}`}
                                                onClick={() => handleSortChange('date', 'desc')}
                                            >
                                                <span className="filter-icon">↓</span>
                                                Новые первыми
                                            </button>
                                            <button 
                                                className={`filter-option ${sortBy === 'date' && sortOrder === 'asc' ? 'active' : ''}`}
                                                onClick={() => handleSortChange('date', 'asc')}
                                            >
                                                <span className="filter-icon">↑</span>
                                                Старые первыми
                                            </button>
                                            <button 
                                                className={`filter-option ${sortBy === 'views' && sortOrder === 'desc' ? 'active' : ''}`}
                                                onClick={() => handleSortChange('views', 'desc')}
                                            >
                                                <span className="filter-icon">↓</span>
                                                Популярные
                                            </button>
                                            <button 
                                                className={`filter-option ${sortBy === 'views' && sortOrder === 'asc' ? 'active' : ''}`}
                                                onClick={() => handleSortChange('views', 'asc')}
                                            >
                                                <span className="filter-icon">↑</span>
                                                Непопулярные
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
                <div className="video-strip">
                    <button
                        className="vs-btn vs-left"
                        onClick={handlePrevious}
                        onMouseEnter={pauseAutoplay}
                        aria-label="Предыдущие видео"
                        disabled={currentPage === 0}
                    >
                        ◀
                    </button>

                    <div
                        ref={trackRef}
                        className={`vs-track ${isLoading ? 'loading' : ''}`}
                        onPointerDown={pauseAutoplay}
                        onMouseEnter={pauseAutoplay}
                        onTouchStart={pauseAutoplay}
                        onWheel={pauseAutoplay}
                    >
                        <div className="vs-items">
                            {isLoading ? (
                                <div className="vs-loading">
                                    <div className="spinner"></div>
                                    <div className="vs-loading-text">Загружаю видео…</div>
                                </div>
                            ) : rawVideos.length === 0 ? (
                                <div className="vs-empty">
                                    <div style={{ fontSize: '18px', marginBottom: '8px' }}>📹</div>
                                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Видео пока нет</div>
                                    <div style={{ fontSize: '14px', opacity: '0.7' }}>Скоро здесь появится новый контент</div>
                                </div>
                            ) : (
                                sortedVideos.map((video) => (
                                    <a
                                        key={video.id}
                                        className="vs-item glass-blur"
                                        href={video.url || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onMouseEnter={pauseAutoplay}
                                    >
                                        <div className="vs-thumb">
                                            {video.thumbnail && (
                                                <img
                                                    src={video.thumbnail}
                                                    alt={video.title || 'Видео'}
                                                    loading="lazy"
                                                />
                                            )}
                                            <div className="vs-play-icon"></div>
                                        </div>
                                        <div className="vs-info">
                                            <div className="vs-title">{video.title || 'Без названия'}</div>
                                            <div className="vs-meta">
                                                <div className="vs-views">
                                                    {formatViews(video.viewCount)}
                                                </div>
                                                <div className="vs-date">
                                                    {video.publishedAt ? formatDate(video.publishedAt) : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </a>
                                ))
                            )}
                        </div>
                    </div>

                    <button
                        className="vs-btn vs-right"
                        onClick={handleNext}
                        onMouseEnter={pauseAutoplay}
                        aria-label="Следующие видео"
                        disabled={currentPage >= totalPages - 1}
                    >
                        ▶
                    </button>
                </div>

                {sortedVideos.length > 0 && (
                    <div className="vs-progress-wrapper">
                        <div className="vs-progress-info">
                            <span className="vs-progress-text glass-blur">
                                {currentPage * videosPerPage + 1}-{Math.min((currentPage + 1) * videosPerPage, sortedVideos.length)} из {sortedVideos.length}
                            </span>

                        </div>
                        {totalPages > 1 && (
                            <div className="vs-indicators">
                                {Array.from({ length: totalPages }).map((_, index) => (
                                    <button
                                        key={index}
                                        className={`vs-dot glass-blur ${index === currentPage ? 'active' : ''}`}
                                        onClick={() => handlePageClick(index)}
                                        aria-label={`Страница ${index + 1} из ${totalPages}`}
                                        aria-current={index === currentPage ? 'true' : 'false'}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}

export default VideoSlider