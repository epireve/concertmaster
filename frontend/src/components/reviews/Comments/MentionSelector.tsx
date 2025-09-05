import React, { useEffect, useState, useRef } from 'react';
import { User, CheckCircle } from 'lucide-react';

interface Mention {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  verified?: boolean;
}

interface MentionSelectorProps {
  users: Mention[];
  onSelect: (mention: Mention) => void;
  onClose: () => void;
  query: string;
}

export const MentionSelector: React.FC<MentionSelectorProps> = ({
  users,
  onSelect,
  onClose,
  query
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % users.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + users.length) % users.length);
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (users[selectedIndex]) {
            onSelect(users[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [users, selectedIndex, isVisible, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex];
    if (selectedItem) {
      selectedItem.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!isVisible || users.length === 0) {
    return null;
  }

  const handleSelect = (user: Mention) => {
    setIsVisible(false);
    onSelect(user);
  };

  return (
    <div
      ref={listRef}
      className="absolute z-50 w-64 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto"
      style={{
        top: '100%',
        left: 0
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-600">
            Mention someone
          </span>
        </div>
      </div>

      {/* User List */}
      <div className="py-1">
        {users.map((user, index) => (
          <button
            key={user.id}
            ref={el => itemRefs.current[index] = el}
            onClick={() => handleSelect(user)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`
              w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none
              ${index === selectedIndex ? 'bg-blue-50' : ''}
            `}
          >
            <div className="flex items-center space-x-3">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.name}
                  </p>
                  {user.verified && (
                    <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  )}
                </div>
                {user.email && (
                  <p className="text-xs text-gray-500 truncate">
                    {user.email}
                  </p>
                )}
              </div>

              {/* Selection Indicator */}
              {index === selectedIndex && (
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-500">
          Use ↑↓ to navigate, Enter to select, Esc to cancel
        </p>
      </div>
    </div>
  );
};