import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, TextInput, Select, Label, VStack, Heading, Text } from 'daleui'
import { getEventByAdminToken, updateEvent } from '../../server/functions/events'

interface EditSearch {
  token: string
}

export const Route = createFileRoute('/$eventId/edit')({
  validateSearch: (search: Record<string, unknown>): EditSearch => ({
    token: (search.token as string) || '',
  }),
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ deps }) => {
    return getEventByAdminToken({ data: { adminToken: deps.token } })
  },
  component: EditEventPage,
})

function EditEventPage() {
  const event = Route.useLoaderData()
  const { token } = Route.useSearch()
  const navigate = useNavigate()

  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description || '')
  const [durationMinutes, setDurationMinutes] = useState(event.durationMinutes)
  const [minParticipants, setMinParticipants] = useState(
    event.minParticipants ? String(event.minParticipants) : '',
  )
  const [organizerEmail, setOrganizerEmail] = useState(event.organizerEmail || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await updateEvent({
        data: {
          eventId: event.id,
          adminToken: token,
          title,
          description: description || undefined,
          durationMinutes,
          minParticipants: minParticipants ? Number(minParticipants) : null,
          organizerEmail: organizerEmail.trim(),
        },
      })
      navigate({
        to: '/$eventId/admin',
        params: { eventId: event.id },
        search: { token },
      })
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave}>
      <VStack align="stretch" gap="24">
        <Heading level={1}>모임 수정</Heading>

        <Field label="모임 제목">
          <TextInput
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <Field label="모임 시간">
          <Select
            value={String(durationMinutes)}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
          >
            <option value="30">30분</option>
            <option value="60">1시간</option>
            <option value="90">1시간 30분</option>
            <option value="120">2시간</option>
          </Select>
        </Field>

        <Field label="최소 인원 (선택)">
          <TextInput
            type="number"
            min={2}
            value={minParticipants}
            onChange={(e) => setMinParticipants(e.target.value)}
            placeholder="미설정 시 인원 제한 없음"
          />
        </Field>

        <Field label="주최자 이메일 (선택)">
          <TextInput
            type="email"
            value={organizerEmail}
            onChange={(e) => setOrganizerEmail(e.target.value)}
            placeholder="입력하면 모임 목록에서 조회 가능"
          />
        </Field>

        <Field label="설명 (선택)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input"
          />
        </Field>

        <VStack align="stretch" gap="12">
          <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
            <p>목표 기간: {new Date(event.eventDateStart).toLocaleDateString('ko-KR')} ~ {new Date(event.eventDateEnd).toLocaleDateString('ko-KR')}</p>
            <p>응답 마감: {new Date(event.responseDeadlineAt).toLocaleDateString('ko-KR')}</p>
            <Text size="xs" tone="neutral" className="mt-1">
              목표 기간과 응답 마감은 참여자 응답에 영향을 주므로 수정할 수 없습니다.
            </Text>
          </div>

          <Button type="submit" fullWidth loading={isSaving}>
            {isSaving ? '저장 중...' : '저장'}
          </Button>
          <Button
            type="button"
            fullWidth
            variant="outline"
            onClick={() => navigate({
              to: '/$eventId/admin',
              params: { eventId: event.id },
              search: { token },
            })}
          >
            취소
          </Button>
        </VStack>
      </VStack>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label labelText={label} />
      {children}
    </div>
  )
}
