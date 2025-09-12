import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, X, Edit3 } from 'lucide-react';

interface InlineEditProps {
  value: string | number;
  onSave: (newValue: string | number) => Promise<void>;
  type?: 'text' | 'number';
  prefix?: string;
  suffix?: string;
  className?: string;
  editClassName?: string;
}

export function InlineEdit({ 
  value, 
  onSave, 
  type = 'text', 
  prefix = '', 
  suffix = '',
  className = '',
  editClassName = ''
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving value:', error);
      setEditValue(value); // Reset to original value on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={`flex items-center gap-2 ${editClassName}`}>
        <Input
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(type === 'number' ? Number(e.target.value) : e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-gray-700 border-gray-600 text-white focus:border-[#B040FF] h-8 text-sm"
          autoFocus
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700"
        >
          <Check className="w-3 h-3" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCancel}
          disabled={isSaving}
          className="h-8 w-8 p-0 bg-gray-700 border-gray-600 hover:bg-gray-600"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`group flex items-center gap-2 ${className}`}>
      <span>{prefix}{value}{suffix}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-gray-400 hover:text-white"
      >
        <Edit3 className="w-3 h-3" />
      </Button>
    </div>
  );
}