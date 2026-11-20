import { Toaster as Sonner } from 'sonner';
import { useStore } from '@/state/store';

export function Toaster() {
  const theme = useStore((s) => s.theme);
  return <Sonner theme={theme === 'auto' ? 'system' : theme} position="bottom-center" offset={{ bottom: 16 }} mobileOffset={{ bottom: 92 }} toastOptions={{ classNames: { toast: '!bg-card !text-card-foreground !border-border', actionButton: '!h-11 !min-w-11 !px-4 !text-sm', closeButton: '!size-11' } }} />;
}
