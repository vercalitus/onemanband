"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-[17px] font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:stroke-[1.75] [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** The primary action of its context. Orange means "act" (DESIGN.md), so a
         *  screen should have one of these, not several. Ink on orange: orange
         *  text on paper fails contrast, the other way round does not. */
        default:
          "bg-signal font-bold text-ink hover:bg-[#D94D25] [a]:hover:bg-[#D94D25]",
        /** Everything else that is a button: paper with a hairline. */
        outline:
          "border-hair bg-paper text-ink hover:bg-ground aria-expanded:bg-ground aria-pressed:border-cobalt aria-pressed:bg-cobalt aria-pressed:text-white",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-slate-200 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        /** Ghost: text-only affordance */
        ghost:
          "hover:bg-sunk hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-cobalt underline underline-offset-3 decoration-1 hover:decoration-2",
      },
      size: {
        default:
          "h-11 gap-2 px-4 has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3",
        xs: "h-8 gap-1 rounded-[4px] px-2 text-[13px] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 gap-1.5 px-3 text-sm in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-5 has-data-[icon=inline-end]:pe-4 has-data-[icon=inline-start]:ps-4",
        icon: "size-11",
        "icon-xs":
          "size-8 rounded-[4px] [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm":
          "size-10",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
