// Drawn icons (one stroke weight), instead of text glyphs.
const P = { className: 'ico', viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false } as const;
export const IconUndo = () => <svg {...P}><path d="M9 7 4 12l5 5" /><path d="M4 12h10a6 6 0 0 1 0 12" transform="translate(0 -5)" /></svg>;
export const IconRedo = () => <svg {...P}><path d="m15 7 5 5-5 5" /><path d="M20 12H10a6 6 0 0 0 0 12" transform="translate(0 -5)" /></svg>;
export const IconLeft = () => <svg {...P}><path d="m15 5-7 7 7 7" /></svg>;
export const IconRight = () => <svg {...P}><path d="m9 5 7 7-7 7" /></svg>;
export const IconPlus = () => <svg {...P}><path d="M12 5v14M5 12h14" /></svg>;
export const IconMinus = () => <svg {...P}><path d="M5 12h14" /></svg>;
export const IconMenu = () => <svg {...P}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const IconCheck = () => <svg {...P}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export const IconWarn = () => <svg {...P}><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v5M12 17.5v.5" /></svg>;
export const IconSplit = () => <svg {...P}><path d="M4 12h16" strokeDasharray="2 3" /><path d="M8 6v12M16 6v12" /></svg>;
export const IconRefresh = () => <svg {...P}><path d="M19 12a7 7 0 1 1-2.1-5" /><path d="M19 4v4h-4" /></svg>;
export const IconHelp = () => <svg {...P}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7" /><path d="M12 17v.5" /></svg>;
export const IconClose = () => <svg {...P}><path d="M6 6l12 12M18 6 6 18" /></svg>;
