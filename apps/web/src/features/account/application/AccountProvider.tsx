import { createContext, useContext, type ReactNode } from 'react';
import type { AccountDataSource, AccountDeletion, FileSaver } from '../domain/account-ports';

export interface AccountServices {
  data: AccountDataSource;
  files: FileSaver;
  deletion: AccountDeletion;
}

const AccountContext = createContext<AccountServices | null>(null);

export function AccountProvider({
  children,
  ...services
}: AccountServices & { children: ReactNode }) {
  return <AccountContext.Provider value={services}>{children}</AccountContext.Provider>;
}

export function useAccountServices(): AccountServices {
  const services = useContext(AccountContext);
  if (!services) throw new Error('Account hooks must be used inside AccountProvider');
  return services;
}
