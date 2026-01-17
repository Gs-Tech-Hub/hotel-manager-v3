import { useCallback } from 'react';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  open?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'destructive';
}

export function useToast() {
  const toast = useCallback(
    ({
      title,
      description,
      variant = 'default',
    }: {
      title?: string;
      description?: string;
      variant?: 'default' | 'destructive';
    }) => {
      // For now, just use console in development, or browser's toast notification
      if (typeof window !== 'undefined') {
        if (variant === 'destructive') {
          console.error(`[${title}] ${description}`);
        } else {
          console.log(`[${title}] ${description}`);
        }
      }
    },
    []
  );

  return { toast };
}
