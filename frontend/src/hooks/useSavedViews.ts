import { useState, useEffect } from 'react';
import { logger } from '../lib/logger';

export interface SavedView {
  id: string;
  name: string;
  isDefault: boolean;
  filters: Record<string, any>;
  search: string;
  visibleColumns?: string[];
  density: 'comfortable' | 'compact';
  pageSize: number;
}

export function useSavedViews(storageKey: string, defaultView: SavedView) {
  const [views, setViews] = useState<SavedView[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      logger.error('Failed to parse saved views', e);
    }
    return [defaultView];
  });

  const [activeViewId, setActiveViewId] = useState<string>(() => {
    try {
      const storedActiveId = localStorage.getItem(`${storageKey}_active`);
      if (storedActiveId && views.find((v) => v.id === storedActiveId)) {
        return storedActiveId;
      }
    } catch (e) {
      logger.error('Failed to parse active view id', e);
    }
    const defaultV = views.find((v) => v.isDefault);
    return defaultV ? defaultV.id : views[0].id;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(views));
  }, [views, storageKey]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}_active`, activeViewId);
  }, [activeViewId, storageKey]);

  const activeView = views.find((v) => v.id === activeViewId) || views[0];

  const saveView = (view: SavedView) => {
    setViews((prev) => {
      let next = [...prev];
      if (view.isDefault) {
        next = next.map((v) => ({ ...v, isDefault: false }));
      }
      const existing = next.findIndex((v) => v.id === view.id);
      if (existing >= 0) {
        next[existing] = view;
      } else {
        next.push(view);
      }
      return next;
    });
    setActiveViewId(view.id);
  };

  const deleteView = (id: string) => {
    setViews((prev) => {
      const next = prev.filter((v) => v.id !== id);
      if (next.length === 0) return [defaultView];
      return next;
    });
    if (activeViewId === id) {
      setActiveViewId(defaultView.id);
    }
  };

  const setDefaultView = (id: string) => {
    setViews((prev) => prev.map((v) => ({ ...v, isDefault: v.id === id })));
  };

  const updateActiveView = (updates: Partial<SavedView>) => {
    setViews((prev) =>
      prev.map((v) => (v.id === activeViewId ? { ...v, ...updates } : v))
    );
  };

  return {
    views,
    activeView,
    activeViewId,
    setActiveViewId,
    saveView,
    deleteView,
    setDefaultView,
    updateActiveView,
  };
}
