import React, { useState } from 'react';
import { Icon } from '../icons';

export interface ModalConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  defaultValue?: string;
  hasInput?: boolean;
  inputPlaceholder?: string;
  onConfirm: (val?: string) => void;
  onCancel?: () => void;
}

export const ConfirmModal: React.FC<{
  config: ModalConfig | null;
  onClose: () => void;
}> = ({ config, onClose }) => {
  if (!config) return null;

  const [inputVal, setInputVal] = useState(config.defaultValue || '');

  const handleConfirm = () => {
    config.onConfirm(config.hasInput ? inputVal : undefined);
    onClose();
  };

  const handleCancel = () => {
    if (config.onCancel) config.onCancel();
    onClose();
  };

  return (
    <div
      className="prof-modal-backdrop"
      onClick={handleCancel}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        className="prof-modal-box"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          color: 'var(--fg)',
          border: '1px solid var(--bd)',
          borderRadius: 20,
          padding: 24,
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: config.isDanger ? 'rgba(239, 68, 68, 0.12)' : 'var(--hv)',
              color: config.isDanger ? '#ef4444' : 'var(--fg)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Icon n={config.isDanger ? 'trash' : config.hasInput ? 'edit' : 'alert'} s={20} />
          </div>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
              {config.title}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--mu)', margin: '2px 0 0' }}>
              {config.message}
            </p>
          </div>
        </div>

        {config.hasInput && (
          <input
            autoFocus
            type="text"
            className="t"
            value={inputVal}
            placeholder={config.inputPlaceholder || 'Enter value...'}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleConfirm();
              if (e.key === 'Escape') handleCancel();
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 14,
              borderRadius: 12,
              border: '1px solid var(--bd)',
              background: 'var(--sb)',
              color: 'var(--fg)',
              outline: 'none',
            }}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '9px 18px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid var(--bd)',
              background: 'var(--hv)',
              color: 'var(--fg)',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            {config.cancelLabel || 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '9px 20px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              border: 0,
              background: config.isDanger ? '#ef4444' : 'var(--fg)',
              color: config.isDanger ? '#ffffff' : 'var(--bg)',
              cursor: 'pointer',
              boxShadow: config.isDanger
                ? '0 4px 14px rgba(239, 68, 68, 0.35)'
                : '0 4px 14px rgba(0, 0, 0, 0.2)',
              transition: 'transform 0.15s ease, opacity 0.15s ease',
            }}
          >
            {config.confirmLabel || (config.isDanger ? 'Delete' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
