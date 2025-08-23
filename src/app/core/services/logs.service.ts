import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, orderBy, limit, getDocs, Timestamp, where } from '@angular/fire/firestore';
import { Observable, from, map, catchError, throwError } from 'rxjs';
import { Log, CreateLogDto } from '../models/log';
import { User } from '../models/user';

@Injectable({
  providedIn: 'root'
})
export class LogsService {

  constructor(private firestore: Firestore) {
    console.log('LogsService инициализирован');
  }

  // Создание нового лога
  createLog(logData: CreateLogDto): Observable<string> {

    const logsRef = collection(this.firestore, 'logs');
    const logWithTimestamp = {
      ...logData,
      timestamp: Timestamp.now()
    };

    return from(addDoc(logsRef, logWithTimestamp)).pipe(
      map(docRef => {
        return docRef.id;
      }),
      catchError(error => {
      return throwError(() => new Error(`Не удалось создать лог: ${error.message}`));
      })
    );
  }

  // Логирование действия пользователя
  logUserAction(user: User, action: string, details?: string): Observable<string> {
    if (!user || !user.id) {
      return throwError(() => new Error('Пользователь не определен'));
    }
    const logData: CreateLogDto = {
      action,
      userId: user.id,
      userName: user.username || 'Неизвестный пользователь',
      userEmail: user.email || 'Нет email',
      userRole: user.role || 'Неизвестная роль',
      details
    };

    return this.createLog(logData);
  }

  // Получение логов
  getLogsWithLimit(limitCount: number = 100): Observable<Log[]> {

    const logsRef = collection(this.firestore, 'logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(limitCount));

    return from(getDocs(q)).pipe(
      map(snapshot => {

        const logs = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            action: data['action'] || 'Неизвестное действие',
            userId: data['userId'] || '',
            userName: data['userName'] || 'Неизвестный пользователь',
            userEmail: data['userEmail'] || 'Нет email',
            userRole: data['userRole'] || 'Неизвестная роль',
            timestamp: data['timestamp']?.toDate() || new Date(),
            details: data['details'] || ''
          } as Log;
        });
        return logs;
      }),
      catchError(error => {
        return throwError(() => new Error(`Не удалось загрузить логи  ${error.message}`));
      })
    );
  }
}
