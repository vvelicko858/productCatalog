export interface Log {
  id: string;
  action: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  timestamp: Date;
  details?: string;
}

export interface CreateLogDto {
  action: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  details?: string;
}
