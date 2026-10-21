import { createContext, useContext, type ReactNode } from 'react';
import type { ChecklistRepository } from '../domain/checklist-ports';

const ChecklistContext = createContext<ChecklistRepository | null>(null);

export function ChecklistProvider({
  repository,
  children,
}: {
  repository: ChecklistRepository;
  children: ReactNode;
}) {
  return <ChecklistContext.Provider value={repository}>{children}</ChecklistContext.Provider>;
}

export function useChecklistRepository(): ChecklistRepository {
  const repository = useContext(ChecklistContext);
  if (!repository) throw new Error('Checklist hooks must be used inside ChecklistProvider');
  return repository;
}
