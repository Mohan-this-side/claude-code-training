// Tremor ProgressBar [v0.0.1]

import { cx } from "@/lib/utils"
import * as React from "react"

/**
 * A horizontal progress bar.
 *
 * The dynamic width has to reach the DOM as a computed value, which is why it
 * is set here rather than in a page: Tailwind cannot generate a class for a
 * runtime percentage, and app code stays Tailwind-only. The other primitives
 * in this directory set dynamic geometry the same way.
 */

const VARIANTS = {
  default: "bg-blue-500 dark:bg-blue-500",
  warning: "bg-amber-500 dark:bg-amber-400",
  error: "bg-red-500 dark:bg-red-500",
  success: "bg-emerald-600 dark:bg-emerald-400",
} as const

type ProgressBarVariant = keyof typeof VARIANTS

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. Values outside the range are clamped. */
  value: number
  variant?: ProgressBarVariant
  /** Accessible name. Required, because a bar with no label says nothing. */
  label: string
}

const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ value, variant = "default", label, className, ...props }, ref) => {
    const percent = Math.min(100, Math.max(0, Math.round(value)))
    return (
      <div
        ref={ref}
        className={cx(
          "h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800",
          className,
        )}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        {...props}
      >
        <div
          className={cx("h-full rounded-full transition-all", VARIANTS[variant])}
          style={{ width: `${percent}%` }}
        />
      </div>
    )
  },
)

ProgressBar.displayName = "ProgressBar"

export { ProgressBar, type ProgressBarProps }
