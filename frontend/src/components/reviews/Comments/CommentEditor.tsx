import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../../shared';
import { MentionSelector } from './MentionSelector';
import { Send, Paperclip, AtSign, Bold, Italic } from 'lucide-react';

interface CommentEditorProps {
  onSubmit: (content: string, mentions: string[]) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  initialValue?: string;
  showCancel?: boolean;
  autoFocus?: boolean;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  allowAttachments?: boolean;
  allowFormatting?: boolean;
}

interface Mention {
  id: string;
  name: string;
  email?: string;
}

// Mock users for mentions - in real implementation, this would come from an API
const MOCK_USERS: Mention[] = [
  { id: 'user1', name: 'John Smith', email: 'john@example.com' },
  { id: 'user2', name: 'Sarah Johnson', email: 'sarah@example.com' },
  { id: 'user3', name: 'Mike Chen', email: 'mike@example.com' },
  { id: 'user4', name: 'Emily Davis', email: 'emily@example.com' },
];

export const CommentEditor: React.FC<CommentEditorProps> = ({
  onSubmit,
  onCancel,
  placeholder = 'Add a comment...',
  initialValue = '',
  showCancel = false,
  autoFocus = false,
  size = 'md',
  loading = false,
  allowAttachments = true,
  allowFormatting = false
}) => {
  const [content, setContent] = useState(initialValue);
  const [mentions, setMentions] = useState<string[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionStartRef = useRef<number>(0);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  // Handle content changes and detect mentions
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setContent(value);
    setCursorPosition(cursorPos);
    
    // Check for mention trigger
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setShowMentions(true);
      setMentionQuery(mentionMatch[1]);
      mentionStartRef.current = cursorPos - mentionMatch[0].length;
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }
  };

  // Handle mention selection
  const handleMentionSelect = (mention: Mention) => {
    if (!textareaRef.current) return;
    
    const beforeMention = content.slice(0, mentionStartRef.current);
    const afterCursor = content.slice(cursorPosition);
    const mentionText = `@${mention.name}`;
    
    const newContent = beforeMention + mentionText + ' ' + afterCursor;
    const newCursorPos = mentionStartRef.current + mentionText.length + 1;
    
    setContent(newContent);
    setMentions(prev => [...prev, mention.id]);
    setShowMentions(false);
    
    // Reset cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(content.trim(), mentions);
      setContent('');
      setMentions([]);
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
    
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  // Filter users based on mention query
  const filteredUsers = MOCK_USERS.filter(user =>
    user.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 5);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'text-sm',
          textarea: 'min-h-[60px] px-3 py-2',
          button: 'text-xs px-3 py-1'
        };
      case 'lg':
        return {
          container: 'text-base',
          textarea: 'min-h-[120px] px-4 py-3',
          button: 'text-sm px-4 py-2'
        };
      default:
        return {
          container: 'text-sm',
          textarea: 'min-h-[80px] px-3 py-2',
          button: 'text-sm px-3 py-2'
        };
    }
  };

  const sizeClasses = getSizeClasses();
  const isEmpty = !content.trim();

  return (
    <form onSubmit={handleSubmit} className={`space-y-3 ${sizeClasses.container}`}>
      <div className="relative">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading || isSubmitting}
          className={`
            w-full resize-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
            disabled:opacity-50 disabled:cursor-not-allowed
            ${sizeClasses.textarea}
          `}
          rows={1}
        />

        {/* Mention Dropdown */}
        {showMentions && filteredUsers.length > 0 && (
          <MentionSelector
            users={filteredUsers}
            onSelect={handleMentionSelect}
            onClose={() => setShowMentions(false)}
            query={mentionQuery}
          />
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Formatting Buttons */}
          {allowFormatting && (
            <div className="flex items-center space-x-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-gray-500 hover:text-gray-700"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-gray-500 hover:text-gray-700"
              >
                <Italic className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Mention Button */}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              if (textareaRef.current) {
                const cursorPos = textareaRef.current.selectionStart;
                const newContent = content.slice(0, cursorPos) + '@' + content.slice(cursorPos);
                setContent(newContent);
                setCursorPosition(cursorPos + 1);
                setShowMentions(true);
                setMentionQuery('');
                mentionStartRef.current = cursorPos;
                
                setTimeout(() => {
                  if (textareaRef.current) {
                    textareaRef.current.setSelectionRange(cursorPos + 1, cursorPos + 1);
                    textareaRef.current.focus();
                  }
                }, 0);
              }
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <AtSign className="h-4 w-4" />
          </Button>

          {/* Attachment Button */}
          {allowAttachments && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-gray-500 hover:text-gray-700"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {showCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={loading || isSubmitting}
              className={sizeClasses.button}
            >
              Cancel
            </Button>
          )}
          
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isEmpty || loading || isSubmitting}
            loading={isSubmitting}
            className={sizeClasses.button}
          >
            <Send className="h-4 w-4 mr-1" />
            {isSubmitting ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>

      {/* Helper Text */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-2">
          <span>Use @ to mention someone</span>
          {mentions.length > 0 && (
            <span>• {mentions.length} mention{mentions.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <span>⌘ + Enter to send</span>
      </div>
    </form>
  );
};