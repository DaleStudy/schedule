import { createFileRoute } from '@tanstack/react-router'

// 일정 페이지는 링크를 받은 사람만 보는 페이지라 검색 엔진에 색인하지 않는다
export const Route = createFileRoute('/$eventId')({
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex' }],
  }),
})
