import type { Conversation } from '@/transcripts/transcript-access'

/**
 * The agent conversation a pane shows, or undefined to show its terminal: the
 * pane runs no agent, or its transcript isn't known (a fresh agent, or no sure match).
 */
export function paneAgent(
  conversation: Conversation | undefined,
  transcriptChosen: boolean,
) {
  if (conversation?.agent == null) return undefined
  // No transcript matched for sure: the terminal is the truth until one is picked.
  if (!conversation.selected && !transcriptChosen) return undefined
  return conversation
}

export const AGENT_NAMES = {
  claude: 'Claude Code',
  codex: 'Codex',
  pi: 'Pi',
} as const
