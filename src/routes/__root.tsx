import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { Link as DaleLink, HStack, Text } from 'daleui'

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
          <div className="mx-auto max-w-4xl px-4 text-center">
            <HStack gap="16" className="mb-3 justify-center">
              <DaleLink href="https://www.dalestudy.com/" external size="sm" tone="neutral">
                DaleStudy
              </DaleLink>
              <DaleLink href="https://github.com/DaleStudy/schedule" external size="sm" tone="neutral">
                GitHub
              </DaleLink>
            </HStack>
            <Text size="xs" tone="neutral">
              &copy; {new Date().getFullYear()} DaleStudy. All rights reserved.
            </Text>
          </div>
        </footer>
        <Scripts />
      </body>
    </html>
  )
}
