'use client'

import type { ComponentProps } from 'react'

import { Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/components/ui/utils'

export interface AsyncButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'aria-disabled'
> {
  /**
   * Whether the button is disabled. This leverages `aria-disabled` to prevent focus and accessibility.
   */
  readonly disabled?: boolean | undefined

  /**
   * Whether the button is loading.
   */
  readonly loading?: boolean | undefined
}

export function AsyncButton({
  children,
  disabled,
  loading,
  ...props
}: AsyncButtonProps) {
  const isDisabled = disabled === true || loading
  return (
    <Button
      aria-disabled={isDisabled}
      {...props}
      className={cn(
        {
          'opacity-50': isDisabled,
          'pointer-events-none': isDisabled,
        },
        props.className,
      )}
      onClick={(e) => {
        if (isDisabled) {
          e.preventDefault()
          return
        }

        props.onClick?.(e)
      }}
    >
      {loading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  )
}
