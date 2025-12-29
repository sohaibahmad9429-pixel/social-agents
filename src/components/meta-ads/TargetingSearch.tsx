'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Users,
  Heart,
  Briefcase,
  GraduationCap,
  Home,
  ShoppingBag,
  Smartphone,
  Globe,
  Loader2,
  Plus,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { TargetingEntity } from '@/types/metaAds';
import { formatNumber } from '@/types/metaAds';

interface TargetingSearchProps {
  type: 'interests' | 'behaviors' | 'demographics';
  selectedItems: TargetingEntity[];
  onSelect: (items: TargetingEntity[]) => void;
  placeholder?: string;
  maxItems?: number;
}

// Meta Marketing API v24.0 - IMPORTANT:
// From October 8, 2025: Some detailed targeting interest options deprecated
// From January 6-15, 2026: Existing campaigns using deprecated interests will stop delivery
// Use combined/suggested options instead

// Mock data for interests - in production, use Meta's Targeting Search API
const MOCK_INTERESTS: TargetingEntity[] = [
  { id: '6003139266461', name: 'Fitness and wellness', audience_size_lower_bound: 500000000, audience_size_upper_bound: 600000000, path: ['Interests', 'Fitness and wellness'] },
  { id: '6003107902433', name: 'Shopping and fashion', audience_size_lower_bound: 800000000, audience_size_upper_bound: 900000000, path: ['Interests', 'Shopping and fashion'] },
  { id: '6003020834693', name: 'Technology', audience_size_lower_bound: 700000000, audience_size_upper_bound: 800000000, path: ['Interests', 'Technology'] },
  { id: '6003384248805', name: 'Travel', audience_size_lower_bound: 600000000, audience_size_upper_bound: 700000000, path: ['Interests', 'Travel'] },
  { id: '6003348604581', name: 'Food and drink', audience_size_lower_bound: 500000000, audience_size_upper_bound: 600000000, path: ['Interests', 'Food and drink'] },
  { id: '6003277229371', name: 'Entertainment', audience_size_lower_bound: 900000000, audience_size_upper_bound: 1000000000, path: ['Interests', 'Entertainment'] },
  { id: '6003397425735', name: 'Business and industry', audience_size_lower_bound: 400000000, audience_size_upper_bound: 500000000, path: ['Interests', 'Business'] },
  { id: '6003012317397', name: 'Sports and outdoors', audience_size_lower_bound: 600000000, audience_size_upper_bound: 700000000, path: ['Interests', 'Sports'] },
  { id: '6003456789012', name: 'Online shopping', audience_size_lower_bound: 700000000, audience_size_upper_bound: 800000000, path: ['Interests', 'Shopping', 'Online shopping'] },
  { id: '6003567890123', name: 'E-commerce', audience_size_lower_bound: 500000000, audience_size_upper_bound: 600000000, path: ['Interests', 'Business', 'E-commerce'] },
  { id: '6003678901234', name: 'Digital marketing', audience_size_lower_bound: 200000000, audience_size_upper_bound: 300000000, path: ['Interests', 'Business', 'Marketing'] },
  { id: '6003789012345', name: 'Entrepreneurship', audience_size_lower_bound: 300000000, audience_size_upper_bound: 400000000, path: ['Interests', 'Business', 'Entrepreneurship'] },
  { id: '6003890123456', name: 'Yoga', audience_size_lower_bound: 200000000, audience_size_upper_bound: 300000000, path: ['Interests', 'Fitness', 'Yoga'] },
  { id: '6003901234567', name: 'Running', audience_size_lower_bound: 300000000, audience_size_upper_bound: 400000000, path: ['Interests', 'Fitness', 'Running'] },
  { id: '6004012345678', name: 'Photography', audience_size_lower_bound: 400000000, audience_size_upper_bound: 500000000, path: ['Interests', 'Hobbies', 'Photography'] },
];

const MOCK_BEHAVIORS: TargetingEntity[] = [
  { id: '6002714895372', name: 'Engaged Shoppers', audience_size_lower_bound: 300000000, audience_size_upper_bound: 400000000, path: ['Behaviors', 'Purchase behavior'] },
  { id: '6002714898572', name: 'Frequent Travelers', audience_size_lower_bound: 200000000, audience_size_upper_bound: 300000000, path: ['Behaviors', 'Travel'] },
  { id: '6017253486583', name: 'Small business owners', audience_size_lower_bound: 100000000, audience_size_upper_bound: 200000000, path: ['Behaviors', 'Business'] },
  { id: '6002714901772', name: 'Technology early adopters', audience_size_lower_bound: 150000000, audience_size_upper_bound: 250000000, path: ['Behaviors', 'Technology'] },
  { id: '6002714904972', name: 'Mobile device users', audience_size_lower_bound: 800000000, audience_size_upper_bound: 900000000, path: ['Behaviors', 'Mobile'] },
  { id: '6002714908172', name: 'Online buyers', audience_size_lower_bound: 500000000, audience_size_upper_bound: 600000000, path: ['Behaviors', 'Purchase behavior'] },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Fitness': Heart,
  'Shopping': ShoppingBag,
  'Technology': Smartphone,
  'Travel': Globe,
  'Business': Briefcase,
  'Education': GraduationCap,
  'Home': Home,
  'default': Users,
};

function getCategoryIcon(path?: string[]): React.ElementType {
  if (!path || path.length < 2) return CATEGORY_ICONS.default;
  const category = path[1];
  return CATEGORY_ICONS[category] || CATEGORY_ICONS.default;
}

export default function TargetingSearch({
  type,
  selectedItems,
  onSelect,
  placeholder = 'Search interests...',
  maxItems = 50,
}: TargetingSearchProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<TargetingEntity[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Simulate API search
  const searchTargeting = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const mockData = type === 'interests' ? MOCK_INTERESTS : MOCK_BEHAVIORS;
    const filtered = mockData.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setResults(filtered);
    setIsSearching(false);
  }, [type]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchTargeting(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchTargeting]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: TargetingEntity) => {
    const isSelected = selectedItems.some(i => i.id === item.id);

    if (isSelected) {
      onSelect(selectedItems.filter(i => i.id !== item.id));
    } else if (selectedItems.length < maxItems) {
      onSelect([...selectedItems, item]);
    }
  };

  const handleRemove = (id: string | number) => {
    onSelect(selectedItems.filter(i => i.id !== id));
  };

  const formatAudienceSize = (lower?: number, upper?: number) => {
    if (!lower || !upper) return '';
    return `${formatNumber(lower)} - ${formatNumber(upper)}`;
  };

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
        {query && !isSearching && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (query || results.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden">
          <ScrollArea className="max-h-64">
            {results.length === 0 && query && !isSearching ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No {type} found for "{query}"
              </div>
            ) : (
              <div className="p-1">
                {results.map((item) => {
                  const isSelected = selectedItems.some(i => i.id === item.id);
                  const Icon = getCategoryIcon(item.path);

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors",
                        isSelected ? "bg-primary/10" : "hover:bg-muted"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        {isSelected ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.path?.slice(1).join(' > ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {formatAudienceSize(item.audience_size_lower_bound, item.audience_size_upper_bound)}
                        </p>
                        <p className="text-xs text-muted-foreground">people</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Selected Items */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <Badge
              key={item.id}
              variant="secondary"
              className="gap-1 pr-1 py-1"
            >
              {item.name}
              <button
                onClick={() => handleRemove(item.id)}
                className="ml-1 p-0.5 hover:bg-muted rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Browse Suggestions */}
      {!query && selectedItems.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase">
            Suggestions
          </p>
          <div className="flex flex-wrap gap-2">
            {(type === 'interests' ? MOCK_INTERESTS : MOCK_BEHAVIORS).slice(0, 6).map((item) => (
              <Button
                key={item.id}
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => handleSelect(item)}
              >
                <Plus className="w-3 h-3" />
                {item.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {selectedItems.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {selectedItems.length} {type} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onSelect([])}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
