import { useState, useEffect } from 'react';
import './FloatingPosts.css';

// Форматирование просмотров
const formatViews = (views) => {
  if (views >= 1000000) {
    return (views / 1000000).toFixed(1) + 'M';
  } else if (views >= 1000) {
    return (views / 1000).toFixed(1) + 'K';
  }
  return views.toString();
};

// Форматирование даты
const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) {
    return `${minutes} мин назад`;
  } else if (hours < 24) {
    return `${hours} ч назад`;
  } else if (days < 7) {
    return `${days} дн назад`;
  } else {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }
};

const FloatingPosts = () => {
  const [posts, setPosts] = useState([]);
  const [channelInfo, setChannelInfo] = useState(null);
  const [visiblePost, setVisiblePost] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHiding, setIsHiding] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Загрузка постов
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch('/api/posts');
        const data = await response.json();

        // Берем все посты (с фото и без, даже без текста)
        const allPosts = (data.posts || []).filter(post => post.text || post.photo);

        setPosts(allPosts);
        setChannelInfo(data.channel);
      } catch (error) {
        console.error('Failed to fetch posts:', error);
      }
    };

    fetchPosts();
    // Обновляем посты каждые 5 минут
    const interval = setInterval(fetchPosts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Система показа постов - по порядку
  useEffect(() => {
    if (posts.length === 0) return;

    const showPost = () => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = prevIndex % posts.length;
        const post = posts[nextIndex];
        
        // Определяем позицию - чередуем слева/справа
        const side = nextIndex % 2 === 0 ? 'left' : 'right';
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // Позиция X - фиксированная для каждой стороны
        const x = side === 'left' ? 20 : Math.max(windowWidth - 370, windowWidth - 400);

        // Позиция Y (рандомная высота)
        const y = Math.max(100, Math.min(windowHeight - 400, Math.random() * (windowHeight - 450) + 100));

        setPosition({ x, y });
        setVisiblePost(post);
        setIsHiding(false);
        
        return nextIndex + 1;
      });

      // Фиксированное время показа: 6 секунд для всех постов
      const displayDuration = 6000;

      setTimeout(() => {
        // Запускаем анимацию исчезновения
        setIsHiding(true);

        // Скрываем пост после анимации (300ms)
        setTimeout(() => {
          setVisiblePost(null);
          setIsHiding(false);
        }, 300);
      }, displayDuration);
    };

    // Первый показ через 3 секунды
    const initialTimer = setTimeout(showPost, 3000);

    // Показываем новый пост каждые 8 секунд (чаще если постов мало)
    const interval = setInterval(showPost, 8000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [posts]);

  // Обработчики
  const handleClick = () => {
    if (channelInfo?.username) {
      window.open(`https://t.me/${channelInfo.username}`, '_blank');
    }
  };

  const handleClose = (e) => {
    e.stopPropagation();
    setIsHiding(true);
    setTimeout(() => {
      setVisiblePost(null);
      setIsHiding(false);
    }, 300);
  };

  if (!visiblePost || !channelInfo) return null;

  return (
    <div
      className={`floating-post ${isHiding ? 'hiding' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onClick={handleClick}
    >
      <button className="floating-post-close" onClick={handleClose} aria-label="Закрыть">
        ×
      </button>

      {visiblePost.photo && (
        <div className="floating-post-media">
          <img
            src={visiblePost.photo}
            alt="Post media"
            className="floating-post-image"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="floating-post-body">
        <div className="floating-post-header">
          <img
            src={channelInfo.photo}
            alt={channelInfo.title}
            className="floating-post-avatar"
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/40/74a0ff/ffffff?text=TG';
            }}
          />
          <div className="floating-post-info">
            <div className="floating-post-channel">{channelInfo.title}</div>
            <div className="floating-post-meta">
              {visiblePost.views > 0 && (
                <span className="floating-post-stat">
                  👁 {formatViews(visiblePost.views)}
                </span>
              )}
              {visiblePost.reactions > 0 && (
                <span className="floating-post-stat">
                  ❤️ {visiblePost.reactions}
                </span>
              )}
              <span className="floating-post-date">
                {formatDate(visiblePost.date)}
              </span>
            </div>
          </div>
        </div>

        <div className="floating-post-content">
          <p className="floating-post-text">{visiblePost.text}</p>
        </div>

        <div className="floating-post-footer">
          <span className="floating-post-cta">Нажми, чтобы посмотреть всё.</span>
        </div>
      </div>
    </div>
  );
};

export default FloatingPosts;
