import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-y rounded-md border border-border bg-surface px-3 py-3 text-base text-fg placeholder:text-subtle disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
