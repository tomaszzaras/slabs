import { useSyncExternalStore } from 'react';
import { lang, onLangChange, type Lang } from '.';

/** The current interface language as React state, for pages that do not use the project store (the landing page). */
export const useLang = (): Lang => useSyncExternalStore(onLangChange, () => lang, () => lang);
