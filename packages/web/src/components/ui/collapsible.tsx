import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { ChevronRight } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/** A titled, collapsible block (replaces <details>). */
export function Section({ title, defaultOpen = false, className, children, id, keepMounted }: { title: React.ReactNode; defaultOpen?: boolean; className?: string; children: React.ReactNode; id?: string; keepMounted?: boolean }) {
  return (
    <CollapsiblePrimitive.Root defaultOpen={defaultOpen} className={cn('border-b last:border-b-0', className)}>
      <CollapsiblePrimitive.Trigger id={id} className="group flex min-h-11 w-full items-center gap-2 rounded-md py-2 text-left text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        {title}
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content className="pb-3 data-[state=closed]:hidden" forceMount={keepMounted ? true : undefined}>{children}</CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  );
}
