import { s } from '../i18n';
import { IconClose } from './Icons';
import { useStore } from '../state/store';

/** Short confirmation with an undo button. Polite live region, so screen readers announce it. */
export function Toast() {
  const toast = useStore((st) => st.toast);
  const { undo, dismissToast } = useStore.getState();
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div className="toast" key={toast.id}>
          <span>{toast.text}</span>
          {toast.undo && <button type="button" id="toast-undo" onClick={undo}>{s.history.toastUndo}</button>}
          <button type="button" aria-label={s.history.close} onClick={dismissToast}><IconClose /></button>
        </div>
      )}
    </div>
  );
}
