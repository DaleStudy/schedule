import { nanoid } from 'nanoid'

export const generateEventId = () => nanoid(12)
export const generateAdminToken = () => nanoid(21)
export const generateParticipantToken = () => nanoid(16)
export const generateSlotId = () => nanoid(12)
