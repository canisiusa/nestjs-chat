import { ChatUser } from './chat-user.types';

export type PollStatus = 'OPEN' | 'CLOSED';

export interface PollOptionResponse {
  id: string;
  text: string;
  voteCount: number;
  votedUserIds: string[];
  position: number;
}

export interface PollResponse {
  id: string;
  channelId: string;
  title: string;
  options: PollOptionResponse[];
  allowMultipleVotes: boolean;
  allowUserSuggestion: boolean;
  closeAt?: string;
  status: PollStatus;
  voterCount: number;
  createdBy?: ChatUser;
  createdAt: string;
  updatedAt: string;
  votedPollOptionIds: string[];
}
