import type { Metadata } from 'next'
import '../src/styles/index.css'

export const metadata: Metadata = {
  title: 'fromoldnuke7 - Telegram канал',
  description: 'Официальная страница Telegram канала fromoldnuke7',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
