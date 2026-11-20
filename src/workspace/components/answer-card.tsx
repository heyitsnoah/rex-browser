import type { AgentPrompt } from '@/workspace/detect-prompt'

/** The choice an agent is stopped at in its terminal, answerable with one tap. */
export function AnswerCard(props: {
  readonly onAnswer: (key: string) => void
  readonly onOpenTerminal: () => void
  readonly prompt: AgentPrompt
}) {
  return (
    <div className="border-primary bg-card mt-1 mb-4 rounded-xl border px-3.5 py-3">
      <p className="text-primary font-mono text-[0.7rem] tracking-wide uppercase">
        Needs your answer
      </p>
      <p className="mt-1.5 mb-2.5 text-sm leading-snug font-medium">
        {props.prompt.question ? (
          <Linked text={props.prompt.question} />
        ) : (
          'The agent is waiting for a choice.'
        )}
      </p>
      <div className="flex flex-col gap-1.5">
        {props.prompt.options.map((option) => (
          <button
            className={`hover:bg-subtle flex min-h-10 items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left text-[0.85rem] leading-snug transition-colors ${option.current ? 'border-input' : 'border-border'}`}
            key={option.key}
            onClick={() => props.onAnswer(option.key)}
            type="button"
          >
            <kbd className="bg-muted grid h-5.5 min-w-5.5 shrink-0 place-items-center rounded font-mono text-xs">
              {option.key}
            </kbd>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span>{option.label}</span>
              {option.detail && (
                <small className="text-muted-foreground text-[0.8rem]">
                  {option.detail}
                </small>
              )}
            </span>
          </button>
        ))}
      </div>
      <button
        className="text-muted-foreground mt-2.5 text-[0.8rem] underline underline-offset-2"
        onClick={props.onOpenTerminal}
        type="button"
      >
        Open terminal
      </button>
    </div>
  )
}

/** Text with its web addresses as links (they open in a new tab). */
function Linked(props: { readonly text: string }) {
  return props.text
    .split(/(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/)
    .map((part, index) =>
      index % 2 ? (
        <a
          className="text-primary break-all underline underline-offset-2"
          href={part}
          key={index}
          rel="noopener noreferrer"
          target="_blank"
        >
          {part}
        </a>
      ) : (
        part
      ),
    )
}
