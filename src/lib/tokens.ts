import { nanoid } from 'nanoid'

export const generateEventId = () => nanoid(8)
export const generateAdminToken = () => nanoid(21)
export const generateSlotId = () => nanoid(12)
