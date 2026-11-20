import {
  BotIcon,
  FileTextIcon,
  GlobeIcon,
  PencilIcon,
  SearchIcon,
  SquareTerminalIcon,
  WrenchIcon,
  XIcon,
} from 'lucide-react'

import { toolKind } from '@/workspace/tool-calls'

export function ToolIcon(props: {
  readonly failed?: boolean
  readonly name: string
}) {
  const className = 'size-3.5 shrink-0 opacity-80'
  if (props.failed) return <XIcon className={`${className} text-destructive`} />
  switch (toolKind(props.name)) {
    case 'agent':
      return <BotIcon className={className} />
    case 'command':
      return <SquareTerminalIcon className={className} />
    case 'edit':
      return <PencilIcon className={className} />
    case 'read':
      return <FileTextIcon className={className} />
    case 'search':
      return <SearchIcon className={className} />
    case 'tool':
      return <WrenchIcon className={className} />
    case 'web':
      return <GlobeIcon className={className} />
  }
}
