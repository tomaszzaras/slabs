import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/** 24 px box inside a 44 px hit area. */
export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn('peer relative grid size-6 shrink-0 place-items-center rounded-[5px] border border-input bg-card shadow-xs outline-none transition-colors before:absolute before:-inset-2.5 before:content-[""] focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground', className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator><Check className="size-4" /></CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
