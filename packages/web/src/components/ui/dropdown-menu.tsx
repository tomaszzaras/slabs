import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;
export function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content sideOffset={sideOffset} className={cn('z-50 min-w-56 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-md', className)} {...props} />
    </DropdownMenuPrimitive.Portal>
  );
}
const item = 'relative flex min-h-11 cursor-default items-center gap-2 rounded-md px-3 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0';
export const DropdownMenuItem = ({ className, ...p }: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) => <DropdownMenuPrimitive.Item className={cn(item, className)} {...p} />;
export function DropdownMenuRadioItem({ className, children, ...p }: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem className={cn(item, 'pr-8', className)} {...p}>
      {children}
      <span className="absolute right-2"><DropdownMenuPrimitive.ItemIndicator><Check /></DropdownMenuPrimitive.ItemIndicator></span>
    </DropdownMenuPrimitive.RadioItem>
  );
}
export const DropdownMenuLabel = ({ className, ...p }: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) => <DropdownMenuPrimitive.Label className={cn('px-3 py-2 text-xs font-medium text-muted-foreground', className)} {...p} />;
export const DropdownMenuSeparator = ({ className, ...p }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) => <DropdownMenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...p} />;
