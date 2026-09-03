'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { accentOf, type Accent } from '@/design/palette';

import { DEMO_DEFAULTS, type DemoSettings } from './settings';

interface DemoValue {
  settings: DemoSettings;
  accent: Accent;
  set: <K extends keyof DemoSettings>(key: K, value: DemoSettings[K]) => void;
}

const DemoStateContext = createContext<DemoValue | null>(null);

/**
 * Demo state lives above both the device and the wave field, because picking an
 * accent is meant to retint the whole hero — that is the product's argument,
 * made without a feature list.
 */
export function DemoProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DemoSettings>(DEMO_DEFAULTS);

  const set = useCallback(
    <K extends keyof DemoSettings>(key: K, value: DemoSettings[K]) => {
      setSettings((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const value = useMemo(
    () => ({ settings, accent: accentOf(settings.accent), set }),
    [settings, set],
  );

  return (
    <DemoStateContext.Provider value={value}>
      {children}
    </DemoStateContext.Provider>
  );
}

export function useDemo(): DemoValue {
  const value = useContext(DemoStateContext);
  if (!value) throw new Error('useDemo must be used inside <DemoProvider>');
  return value;
}
