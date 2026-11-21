import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/** shadcn/ui Sheet (Radix Dialog): a panel that slides in from an edge; `bottom` is the phone's bottom sheet. */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: 'bottom' | 'right'; closeLabel?: string }
>(({ className, children, side = 'bottom', closeLabel = 'Close', ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 flex flex-col gap-2 border bg-card text-card-foreground shadow-lg outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
        side === 'bottom' && 'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-xl border-b-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        side === 'right' && 'inset-y-0 right-0 w-[380px] max-w-full border-r-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50" aria-label={closeLabel}>
        <X className="size-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = 'SheetContent';
