import type { Conversation } from '@/transcripts/transcript-access'

/**
 * The agent conversation a pane shows, or undefined to show its terminal: the
 * pane runs no agent, or a fresh agent hasn't written a transcript yet.
 */
export function paneAgent(
  conversation: Conversation | undefined,
  transcriptChosen: boolean,
) {
  if (conversation?.agent == null) return undefined
  if (
    !conversation.selected &&
    conversation.candidates.length === 0 &&
    !transcriptChosen
  ) {
    return undefined
  }
  return conversation
}

export const AGENT_NAMES = {
  claude: 'Claude Code',
  codex: 'Codex',
  pi: 'Pi',
} as const
