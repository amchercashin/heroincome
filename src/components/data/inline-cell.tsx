import { useState, useRef, useEffect } from 'react';

interface InlineCellProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  type?: 'text' | 'number';
}

export function InlineCell({ value, onSave, className = '', type = 'text' }: InlineCellProps) {
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
        className={`bg-[var(--way-void)] border border-[var(--way-gold)] rounded px-1.5 py-0.5 text-[var(--way-text)] outline-none ${className}`}
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
      className={`cursor-pointer hover:bg-[var(--way-stone)] rounded px-1 -mx-1 transition-colors ${className}`}
    >
      {value || '\u2014'}
    </span>
  );
}
