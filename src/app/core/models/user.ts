export type UserRole = 'Simple' | 'Advanced' | 'Admin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isBlocked?: boolean;
}
