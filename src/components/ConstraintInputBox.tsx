import React, { useEffect, useRef } from 'react';

interface ConstraintInputBoxProps {
  position: { x: number; y: number };
  currentValue: number;
  unit: string;
  onConfirm: (value: number) => void;
  onCancel: () => void;
}

export const ConstraintInputBox: React.FC<ConstraintInputBoxProps> = ({
  position,
  currentValue,
  unit,
  onConfirm,
  onCancel
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(inputRef.current?.value || '0');
    if (!isNaN(value)) {
      onConfirm(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{
      position: 'absolute',
      left: position.x,
      top: position.y,
      background: 'white',
      border: '2px solid #2196f3',
      borderRadius: '4px',
      padding: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      zIndex: 1000
    }}>
      <input
        ref={inputRef}
        type="number"
        defaultValue={currentValue}
        step="0.1"
        onKeyDown={handleKeyDown}
        style={{
          width: '80px',
          padding: '4px',
          border: '1px solid #ccc',
          borderRadius: '2px'
        }}
      />
      <span style={{ marginLeft: '4px' }}>{unit}</span>
      <div style={{ marginTop: '4px', fontSize: '10px', color: '#666' }}>
        Enter to apply, Esc to cancel
      </div>
    </form>
  );
};
