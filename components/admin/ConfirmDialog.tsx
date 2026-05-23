'use client';
import { AnimatePresence, motion } from 'framer-motion';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'CONFIRM',
  cancelText = 'CANCEL',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={busy ? undefined : onCancel}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-bold font-syncopate tracking-widest">{title}</h2>
                <p className="text-sm text-white/60 mt-4">{message}</p>

                <div className="flex justify-end gap-4 border-t border-white/10 pt-6 mt-8">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy}
                    className="px-6 py-2 rounded-md font-syncopate text-xs tracking-widest font-bold text-white/70 hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {cancelText}
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={busy}
                    className={
                      (danger
                        ? 'bg-red-500 text-white hover:bg-red-500/90 '
                        : 'bg-white text-black hover:bg-white/90 ') +
                      'font-syncopate text-xs font-bold tracking-widest px-8 py-2 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
                    }
                  >
                    {busy ? 'WORKING...' : confirmText}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

