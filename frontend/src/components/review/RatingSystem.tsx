import React, { useState, useCallback } from 'react';
import { RatingSystemProps } from '../../types/review';

interface StarProps {
  filled: boolean;
  halfFilled?: boolean;
  size: number;
  interactive: boolean;
  onRate?: () => void;
  onHover?: () => void;
  onLeave?: () => void;
}

const Star: React.FC<StarProps> = ({ 
  filled, 
  halfFilled, 
  size, 
  interactive, 
  onRate, 
  onHover, 
  onLeave 
}) => {
  return (
    <button
      type="button"
      className={`
        ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      onClick={onRate}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      disabled={!interactive}
      aria-label={`Rate ${filled ? 'filled' : 'empty'} star`}
    >
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        className="transition-colors"
      >
        <defs>
          <linearGradient id={`half-fill-${size}`}>
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="50%" stopColor="#e5e7eb" />
          </linearGradient>
        </defs>
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={
            filled 
              ? '#fbbf24' 
              : halfFilled 
                ? `url(#half-fill-${size})` 
                : '#e5e7eb'
          }
          stroke={filled || halfFilled ? '#f59e0b' : '#d1d5db'}
          strokeWidth="1"
        />
      </svg>
    </button>
  );
};

export const RatingSystem: React.FC<RatingSystemProps> = ({
  value,
  max = 5,
  size = 'md',
  interactive = false,
  showCount = false,
  reviewCount = 0,
  onChange,
  disabled = false,
  precision = 'full'
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  
  const starSizes = {
    sm: 16,
    md: 20,
    lg: 24
  };
  
  const starSize = starSizes[size];
  
  const handleStarClick = useCallback((rating: number) => {
    if (!interactive || disabled || !onChange) return;
    
    if (precision === 'half') {
      // For half precision, allow 0.5 increments
      onChange(rating + 0.5);
    } else {
      onChange(rating + 1);
    }
  }, [interactive, disabled, onChange, precision]);
  
  const handleStarHover = useCallback((rating: number, isHalf?: boolean) => {
    if (!interactive || disabled) return;
    
    if (precision === 'half' && isHalf) {
      setHoverValue(rating + 0.5);
    } else {
      setHoverValue(rating + 1);
    }
  }, [interactive, disabled, precision]);
  
  const handleMouseLeave = useCallback(() => {
    if (!interactive || disabled) return;
    setHoverValue(null);
  }, [interactive, disabled]);
  
  const displayValue = hoverValue ?? value;
  
  const renderStars = () => {
    const stars = [];
    
    for (let i = 0; i < max; i++) {
      const starValue = i + 1;
      const filled = displayValue >= starValue;
      const halfFilled = precision === 'half' && displayValue >= i + 0.5 && displayValue < starValue;
      
      if (precision === 'half' && interactive) {
        // Render two halves for half precision
        stars.push(
          <div key={`star-${i}`} className="relative inline-block">
            {/* Left half */}
            <button
              type="button"
              className={`
                absolute left-0 w-1/2 h-full z-10
                ${interactive ? 'cursor-pointer' : 'cursor-default'}
                focus:outline-none
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              onClick={() => handleStarClick(i)}
              onMouseEnter={() => handleStarHover(i, true)}
              onMouseLeave={handleMouseLeave}
              disabled={!interactive || disabled}
              aria-label={`Rate ${i + 0.5} stars`}
            />
            
            {/* Right half */}
            <button
              type="button"
              className={`
                absolute right-0 w-1/2 h-full z-10
                ${interactive ? 'cursor-pointer' : 'cursor-default'}
                focus:outline-none
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              onClick={() => handleStarClick(i)}
              onMouseEnter={() => handleStarHover(i, false)}
              onMouseLeave={handleMouseLeave}
              disabled={!interactive || disabled}
              aria-label={`Rate ${i + 1} stars`}
            />
            
            {/* Star visual */}
            <Star
              filled={filled}
              halfFilled={halfFilled}
              size={starSize}
              interactive={false} // Handled by overlays
            />
          </div>
        );
      } else {
        // Simple full star precision
        stars.push(
          <Star
            key={`star-${i}`}
            filled={filled}
            halfFilled={halfFilled}
            size={starSize}
            interactive={interactive && !disabled}
            onRate={() => handleStarClick(i)}
            onHover={() => handleStarHover(i, false)}
            onLeave={handleMouseLeave}
          />
        );
      }
    }
    
    return stars;
  };
  
  return (
    <div className="flex items-center space-x-2">
      {/* Stars */}
      <div 
        className="flex items-center space-x-0.5"
        role="radiogroup"
        aria-label={`Rating: ${value} out of ${max} stars`}
        onMouseLeave={handleMouseLeave}
      >
        {renderStars()}
      </div>
      
      {/* Rating Value Display */}
      <span className="text-sm text-gray-600 min-w-max">
        <span className="font-medium">
          {displayValue.toFixed(precision === 'half' ? 1 : 0)}
        </span>
        <span className="text-gray-400">/{max}</span>
      </span>
      
      {/* Review Count */}
      {showCount && (
        <span className="text-sm text-gray-500">
          ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
        </span>
      )}
      
      {/* Screen reader text for current rating */}
      <span className="sr-only">
        Current rating: {value} out of {max} stars
        {showCount && `, based on ${reviewCount} reviews`}
      </span>
    </div>
  );
};

// Utility component for display-only ratings
export const DisplayRating: React.FC<{
  rating: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  showCount?: boolean;
  reviewCount?: number;
}> = ({ rating, max = 5, size = 'md', showValue = true, showCount = false, reviewCount = 0 }) => (
  <RatingSystem
    value={rating}
    max={max}
    size={size}
    interactive={false}
    showCount={showCount}
    reviewCount={reviewCount}
    precision="half"
  />
);

// Utility hook for managing rating state
export const useRating = (initialRating: number = 0) => {
  const [rating, setRating] = useState(initialRating);
  const [isModified, setIsModified] = useState(false);
  
  const updateRating = useCallback((newRating: number) => {
    setRating(newRating);
    setIsModified(newRating !== initialRating);
  }, [initialRating]);
  
  const resetRating = useCallback(() => {
    setRating(initialRating);
    setIsModified(false);
  }, [initialRating]);
  
  return {
    rating,
    updateRating,
    resetRating,
    isModified
  };
};