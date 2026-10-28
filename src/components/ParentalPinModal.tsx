import React, { useEffect, useState } from 'react';
import { CheckCircle2, Delete, KeyRound, Lock, ShieldAlert, X } from 'lucide-react';
import { storageService } from '../services/storageService';
import { isTvBackKey, TIZEN_KEYS } from '../services/tizenBridge';

export type PinModalMode = 'verify' | 'change_pin';

interface ParentalPinModalProps {
  isOpen: boolean;
  mode?: PinModalMode;
  targetTitle: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const KEYPAD_BUTTONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0', 'CANCEL'];

export const ParentalPinModal: React.FC<ParentalPinModalProps> = ({
  isOpen,
  mode = 'verify',
  targetTitle,
  onSuccess,
  onCancel,
}) => {
  const [enteredPin, setEnteredPin] = useState('');
  const [changeStep, setChangeStep] = useState<'verify_old' | 'enter_new' | 'done'>('verify_old');
  const [focusedKeyIndex, setFocusedKeyIndex] = useState<number>(4); // Começa no '5' (centro do teclado)
  const [errorShake, setErrorShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEnteredPin('');
      setChangeStep('verify_old');
      setFocusedKeyIndex(4);
      setErrorMessage(null);
      setErrorShake(false);
    }
  }, [isOpen, mode]);

  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setErrorShake(true);
    window.setTimeout(() => {
      setEnteredPin('');
      setErrorShake(false);
    }, 550);
  };

  const verifyOrAppendDigit = (nextPin: string) => {
    const savedPin = storageService.getParentalPin();
    const targetLen = mode === 'change_pin' && changeStep === 'enter_new' ? 4 : savedPin.length;

    if (nextPin.length >= targetLen) {
      if (mode === 'verify') {
        if (nextPin === savedPin) {
          onSuccess();
        } else {
          triggerError('Senha Parental incorreta! Tente novamente (Padrão: 0000).');
        }
        return;
      }

      // Modo de alteração de senha parental (2 etapas pelo controle remoto)
      if (changeStep === 'verify_old') {
        if (nextPin === savedPin) {
          setEnteredPin('');
          setErrorMessage(null);
          setChangeStep('enter_new');
        } else {
          triggerError('Senha atual incorreta! (Padrão de fábrica: 0000).');
        }
      } else if (changeStep === 'enter_new') {
        storageService.setParentalPin(nextPin);
        setChangeStep('done');
        window.setTimeout(() => {
          onSuccess();
        }, 900);
      }
    }
  };

  const handlePressButton = (keyVal: string) => {
    if (changeStep === 'done') return;
    setErrorMessage(null);
    if (keyVal === 'CLEAR') {
      setEnteredPin((prev) => prev.slice(0, -1));
      return;
    }
    if (keyVal === 'CANCEL') {
      onCancel();
      return;
    }
    setEnteredPin((prev) => {
      const next = (prev + keyVal).slice(0, 8);
      verifyOrAppendDigit(next);
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();

      if (isTvBackKey(e)) {
        e.preventDefault();
        onCancel();
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        setEnteredPin((prev) => prev.slice(0, -1));
        return;
      }

      // Teclas numéricas diretas do controle remoto ou teclado
      if (e.keyCode >= TIZEN_KEYS.NUM_0 && e.keyCode <= TIZEN_KEYS.NUM_9) {
        e.preventDefault();
        const digit = String(e.keyCode - TIZEN_KEYS.NUM_0);
        handlePressButton(digit);
        return;
      }

      // Navegação D-Pad 3x4 no teclado numérico na tela da TV
      const col = focusedKeyIndex % 3;
      const row = Math.floor(focusedKeyIndex / 3);

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextCol = (col + 1) % 3;
        setFocusedKeyIndex(row * 3 + nextCol);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevCol = (col + 2) % 3;
        setFocusedKeyIndex(row * 3 + prevCol);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextRow = (row + 1) % 4;
        setFocusedKeyIndex(nextRow * 3 + col);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevRow = (row + 3) % 4;
        setFocusedKeyIndex(prevRow * 3 + col);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const keyVal = KEYPAD_BUTTONS[focusedKeyIndex];
        if (keyVal) handlePressButton(keyVal);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, focusedKeyIndex, enteredPin, changeStep, mode]);

  if (!isOpen) return null;

  const savedPinLen =
    mode === 'change_pin' && changeStep === 'enter_new'
      ? 4
      : Math.max(4, storageService.getParentalPin().length);

  return (
    <div className="tv-modal-backdrop" onClick={onCancel}>
      <div
        className={`parental-pin-card ${errorShake ? 'shake-error' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="parental-header">
          <div className="parental-lock-badge">
            {mode === 'change_pin' ? <KeyRound size={28} /> : <Lock size={28} />}
          </div>
          {mode === 'change_pin' ? (
            <>
              <h2>Atualizar Senha Parental</h2>
              <p>
                {changeStep === 'verify_old' && (
                  <>
                    Passo 1 de 2: Digite a <strong>Senha Parental ATUAL</strong>
                  </>
                )}
                {changeStep === 'enter_new' && (
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                    Passo 2 de 2: Digite a NOVA Senha (4 números)
                  </span>
                )}
                {changeStep === 'done' && (
                  <span style={{ color: '#4ade80', fontWeight: 700 }}>
                    Senha Parental atualizada com sucesso!
                  </span>
                )}
              </p>
            </>
          ) : (
            <>
              <h2>Controle Parental (+18)</h2>
              <p>
                Digite a Senha Parental para confirmar: <strong>{targetTitle}</strong>
              </p>
            </>
          )}
        </div>

        {changeStep === 'done' ? (
          <div className="mobile-success-box" style={{ width: '100%', justifyContent: 'center' }}>
            <CheckCircle2 size={22} color="#22c55e" />
            <strong>Nova Senha Parental salva na memória da TV!</strong>
          </div>
        ) : (
          <>
            {/* Visor de Bolinhas do PIN */}
            <div className="pin-dots-display">
              {Array.from({ length: savedPinLen }).map((_, idx) => {
                const isFilled = idx < enteredPin.length;
                return (
                  <div key={idx} className={`pin-dot-box ${isFilled ? 'filled' : ''}`}>
                    {isFilled ? '●' : ''}
                  </div>
                );
              })}
            </div>

            {errorMessage && (
              <div className="pin-error-banner">
                <ShieldAlert size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Teclado Virtual D-Pad para Controle Remoto Samsung */}
            <div className="pin-keypad-grid">
              {KEYPAD_BUTTONS.map((btn, idx) => {
                const isFocused = focusedKeyIndex === idx;
                const isAction = btn === 'CLEAR' || btn === 'CANCEL';
                return (
                  <button
                    key={btn}
                    type="button"
                    className={`pin-key-btn ${isFocused ? 'dpad-focused' : ''} ${
                      isAction ? 'action-key' : ''
                    }`}
                    onMouseEnter={() => setFocusedKeyIndex(idx)}
                    onClick={() => handlePressButton(btn)}
                  >
                    {btn === 'CLEAR' ? (
                      <>
                        <Delete size={18} /> Apagar
                      </>
                    ) : btn === 'CANCEL' ? (
                      <>
                        <X size={18} /> Cancelar
                      </>
                    ) : (
                      btn
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <span className="pin-footer-hint">
          Use as <strong>Setas + OK</strong> ou os números do controle • Senha padrão:{' '}
          <strong>0000</strong>
        </span>
      </div>
    </div>
  );
};
