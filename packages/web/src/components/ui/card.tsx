import * as React from 'react';
import { cn } from '@/lib/utils';

export const Card = ({ className, ...p }: React.ComponentProps<'div'>) => <div className={cn('rounded-xl border bg-card text-card-foreground shadow-xs', className)} {...p} />;
export const CardHeader = ({ className, ...p }: React.ComponentProps<'div'>) => <div className={cn('flex flex-col gap-1 px-5 pt-5', className)} {...p} />;
export const CardTitle = ({ className, ...p }: React.ComponentProps<'h2'>) => <h2 className={cn('text-base leading-none font-semibold', className)} {...p} />;
export const CardDescription = ({ className, ...p }: React.ComponentProps<'p'>) => <p className={cn('text-sm text-muted-foreground', className)} {...p} />;
export const CardContent = ({ className, ...p }: React.ComponentProps<'div'>) => <div className={cn('px-5 py-4', className)} {...p} />;
