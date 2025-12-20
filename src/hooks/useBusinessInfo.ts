'use client';

import { useState, useEffect, useCallback } from 'react';
import { BusinessInfo, DEFAULT_BUSINESS_INFO } from '@/types/businessInfo.types';
import {
  getBusinessSettings,
  updateBusinessSettings,
} from '@/lib/python-backend/api/workspace';
import type { BusinessSettings } from '@/lib/python-backend/types';

export function useBusinessInfo() {
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(DEFAULT_BUSINESS_INFO);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load from Python backend on mount
  useEffect(() => {
    const loadBusinessInfo = async () => {
      try {
        const data = await getBusinessSettings();

        if (data) {
          // Map backend fields to BusinessInfo type
          // The backend stores different fields, so we map what we can
          setBusinessInfo({
            ...DEFAULT_BUSINESS_INFO,
            businessName: (data as any).business_name || data.name || '',
            industry: data.industry || '',
            brandDescription: data.description || '',
            website: data.website || undefined,
            targetMarket: data.target_audience || '',
            brandColors: data.brand_colors || [],
            // Map tone_of_voice to preferredTone array
            preferredTone: (data as any).tone_of_voice
              ? [(data as any).tone_of_voice]
              : data.brand_voice
                ? [data.brand_voice]
                : [],
          });
        } else {
          // No settings yet, use defaults
          setBusinessInfo(DEFAULT_BUSINESS_INFO);
        }
      } catch (e: any) {
        console.error('Failed to load business settings:', e);
        setError('Failed to load business settings');
        // Fall back to defaults on error
        setBusinessInfo(DEFAULT_BUSINESS_INFO);
      } finally {
        setIsLoaded(true);
      }
    };

    loadBusinessInfo();
  }, []);

  // Save to Python backend
  const saveBusinessInfo = useCallback(async (data: BusinessInfo) => {
    setIsSaving(true);
    setError(null);
    try {
      // Use Python backend API client - map BusinessInfo to backend format
      const savedData = await updateBusinessSettings({
        name: data.businessName,
        industry: data.industry,
        description: data.brandDescription,
        website: data.website,
        target_audience: data.targetMarket,
        brand_colors: data.brandColors,
        social_links: undefined, // not present in BusinessInfo
        // Map preferredTone array to single tone/voice
        brand_voice: data.preferredTone?.length > 0 ? data.preferredTone[0] : undefined,
      } as Partial<BusinessSettings>);

      // Update local state with saved data
      setBusinessInfo({
        ...DEFAULT_BUSINESS_INFO,
        ...data, // Keep the full local state
        // Update with any backend transformations
        businessName:
          (savedData as any).business_name ||
          savedData.name ||
          (savedData as any).businessName ||
          data.businessName,
        industry: savedData.industry || data.industry,
      });
      return true;
    } catch (e: any) {
      const errorMessage = e.response?.data?.detail || e.message || 'Failed to save business settings';
      setError(errorMessage);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Update specific fields
  const updateField = useCallback(<K extends keyof BusinessInfo>(
    field: K,
    value: BusinessInfo[K]
  ) => {
    setBusinessInfo(prev => ({ ...prev, [field]: value }));
  }, []);

  // Add item to array field
  const addToArray = useCallback((field: keyof BusinessInfo, value: string) => {
    setBusinessInfo(prev => {
      const current = prev[field];
      if (Array.isArray(current) && !current.includes(value)) {
        return { ...prev, [field]: [...current, value] };
      }
      return prev;
    });
  }, []);

  // Remove item from array field
  const removeFromArray = useCallback((field: keyof BusinessInfo, value: string) => {
    setBusinessInfo(prev => {
      const current = prev[field];
      if (Array.isArray(current)) {
        return { ...prev, [field]: current.filter(v => v !== value) };
      }
      return prev;
    });
  }, []);

  // Check if business info is complete
  const isComplete = useCallback(() => {
    return !!(
      businessInfo.businessName &&
      businessInfo.industry &&
      businessInfo.brandDescription &&
      businessInfo.targetMarket
    );
  }, [businessInfo]);

  return {
    businessInfo,
    isLoaded,
    isSaving,
    error,
    saveBusinessInfo,
    updateField,
    addToArray,
    removeFromArray,
    isComplete,
  };
}
