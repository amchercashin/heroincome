import { useState, useRef, useEffect } from 'react';

interface InlineCellProps {
  value: string;
  displayValue?: string;
  onSave: (value: string) => void;
  className?: string;
  type?: 'text' | 'number';
}

export function InlineCell({ value, displayValue, onSave, className = '', type = 'text' }: InlineCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    setEditing(false);
    if (editValue !== value) {
      onSave(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        style={{ width: `${Math.max(editValue.length + 2, 6)}ch` }}
        className={`max-w-full bg-[var(--way-void)] border border-[var(--way-gold)] rounded px-1.5 py-0.5 !text-base text-[var(--way-text)] outline-none ${className}`}
        inputMode={type === 'number' ? 'decimal' : 'text'}
      />
    );
  }

  return (
    <span
      onClick={() => {
        setEditValue(value);
        setEditing(true);
      }}
      className={`cursor-pointer border-b border-dashed border-[var(--way-shadow)] hover:border-[var(--way-gold)] transition-colors ${className}`}
    >
      {(displayValue ?? value) || '\u2014'}
    </span>
  );
}
