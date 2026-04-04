import type { Poll, PollOption } from '../../../core/types'
import { PollStatus } from '../../../core/types'
import type { RawCustomUser } from './userMapper'
import { mapCustomUser } from './userMapper'

export interface RawCustomPollOption {
  id: string | number
  text: string
  voteCount?: number
  votedUserIds?: string[]
  createdAt?: string | number
  updatedAt?: string | number
}

export interface RawCustomPoll {
  id: string | number
  channelId?: string
  title: string
  options: RawCustomPollOption[]
  allowMultipleVotes?: boolean
  allowUserSuggestion?: boolean
  closeAt?: string | number
  status?: string
  voterCount?: number
  createdAt: string | number
  updatedAt?: string | number
  createdBy?: RawCustomUser
  votedPollOptionIds?: number[]
}

const toTimestamp = (value: string | number | undefined): number | undefined => {
  if (value === undefined || value === null) return undefined
  return typeof value === 'string' ? new Date(value).getTime() : value
}

export const mapCustomPoll = (raw: RawCustomPoll): Poll => {
  const options: PollOption[] = (raw.options ?? []).map((opt) => ({
    id: String(opt.id),
    text: opt.text,
    voteCount: opt.voteCount ?? 0,
    votedUserIds: opt.votedUserIds ?? [],
    createdAt: toTimestamp(opt.createdAt),
    updatedAt: toTimestamp(opt.updatedAt),
  }))

  return {
    id: String(raw.id),
    title: raw.title,
    options,
    allowMultipleVotes: raw.allowMultipleVotes ?? false,
    allowUserSuggestion: raw.allowUserSuggestion ?? false,
    closeAt: toTimestamp(raw.closeAt),
    status: raw.status === 'closed' ? PollStatus.CLOSED : PollStatus.OPEN,
    voterCount: raw.voterCount ?? 0,
    createdAt: toTimestamp(raw.createdAt) ?? Date.now(),
    updatedAt: toTimestamp(raw.updatedAt),
    createdBy: raw.createdBy ? mapCustomUser(raw.createdBy) : undefined,
    votedPollOptionIds: raw.votedPollOptionIds ?? [],
  }
}
