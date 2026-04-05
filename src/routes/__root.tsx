import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'DaleSchedule' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <a href="/" className="text-xl font-bold text-blue-600">
              DaleSchedule
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">
          {children}
        </main>
        <footer className="mt-12 border-t bg-gray-50 py-8">
          <div className="mx-auto max-w-4xl px-4 text-center text-sm text-gray-400">
            <div className="mb-3 flex items-center justify-center gap-4">
              <a href="https://www.dalestudy.com/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
                DaleStudy
              </a>
              <span>|</span>
              <a href="https://github.com/DaleStudy/schedule" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
                GitHub
              </a>
            </div>
            <p>&copy; {new Date().getFullYear()} DaleStudy. All rights reserved.</p>
          </div>
        </footer>
        <Scripts />
      </body>
    </html>
  )
}
