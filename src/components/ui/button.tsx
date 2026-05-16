"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Button system — visually distinct tiers:
 * - default (Primary): solid brand, tall, soft colored shadow
 * - outline + secondary (Secondary): bordered / soft fill
 * - ghost: no chrome, hover wash only
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-2xl border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-[transform,box-shadow,colors] duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/25 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:stroke-[1.75] [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-lg shadow-sky-500/30 hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-xl hover:shadow-sky-500/35",
        outline:
          "border-2 border-sky-200 bg-white text-slate-800 shadow-sm hover:border-sky-300 hover:bg-sky-50/90 aria-expanded:bg-sky-50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-slate-100 text-slate-800 shadow-sm hover:bg-slate-200/90 aria-expanded:bg-slate-200",
        ghost:
          "text-slate-700 hover:bg-sky-100/70 hover:text-slate-900 aria-expanded:bg-slate-100 dark:hover:bg-muted/50",
        destructive:
          "bg-amber-100/90 text-amber-900 shadow-sm hover:bg-amber-200/90 focus-visible:border-amber-300 focus-visible:ring-amber-200/50 dark:bg-destructive/25 dark:text-destructive dark:hover:bg-destructive/35",
        link: "rounded-md text-primary shadow-none hover:underline underline-offset-4",
      },
      size: {
        default: "h-10 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-8 gap-1.5 rounded-xl px-3 text-xs has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-xl px-4 text-[0.8125rem] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-6 text-[0.9375rem] has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-10 rounded-2xl",
        "icon-xs": "size-8 rounded-xl [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-xl",
        "icon-lg": "size-11 rounded-2xl",
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
