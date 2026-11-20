// lucide-react icons under the names the app uses (one stroke weight, decorative: always paired with text or a label).
import { AlertTriangle, Check, Menu, Minus, Plus, Redo2, RefreshCw, Scissors, Undo2, X } from 'lucide-react';

const deco = { 'aria-hidden': true, focusable: false } as const;
export const IconCheck = () => <Check className="size-4" {...deco} />;
export const IconClose = () => <X className="size-4" {...deco} />;
export const IconMenu = () => <Menu className="size-4" {...deco} />;
export const IconMinus = () => <Minus className="size-4" {...deco} />;
export const IconPlus = () => <Plus className="size-4" {...deco} />;
export const IconRedo = () => <Redo2 className="size-4" {...deco} />;
export const IconRefresh = () => <RefreshCw className="size-4" {...deco} />;
export const IconSplit = () => <Scissors className="size-4" {...deco} />;
export const IconUndo = () => <Undo2 className="size-4" {...deco} />;
export const IconWarn = () => <AlertTriangle className="size-4" {...deco} />;
