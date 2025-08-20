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
    console.log('Попытка создания лога:', logData);

    const logsRef = collection(this.firestore, 'logs');
    const logWithTimestamp = {
      ...logData,
      timestamp: Timestamp.now()
    };

    console.log('Данные лога с временной меткой:', logWithTimestamp);

    return from(addDoc(logsRef, logWithTimestamp)).pipe(
      map(docRef => {
        console.log('Лог успешно создан с ID:', docRef.id);
        return docRef.id;
      }),
      catchError(error => {
        console.error('Ошибка создания лога:', error);
        console.error('Детали ошибки:', {
          code: error.code,
          message: error.message,
          stack: error.stack
        });
        return throwError(() => new Error(`Не удалось создать лог: ${error.message}`));
      })
    );
  }

  // Логирование действия пользователя
  logUserAction(user: User, action: string, details?: string): Observable<string> {
    console.log('Попытка логирования действия пользователя:', { user, action, details });

    if (!user || !user.id) {
      console.error('Пользователь не определен для логирования:', user);
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

    console.log('Данные для логирования:', logData);

    return this.createLog(logData);
  }

  // Получение логов
  getLogsWithLimit(limitCount: number = 100): Observable<Log[]> {
    console.log(`Попытка получения логов: ${limitCount}`);

    const logsRef = collection(this.firestore, 'logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(limitCount));

    return from(getDocs(q)).pipe(
      map(snapshot => {
        console.log(`Получено документов логов (лимит ${limitCount}):`, snapshot.docs.length);

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

        console.log('Обработанные логи с ограничением:', logs);
        return logs;
      }),
      catchError(error => {
        console.error('Ошибка получения логов с ограничением:', error);
        console.error('Детали ошибки:', {
          code: error.code,
          message: error.message,
          stack: error.stack
        });
        return throwError(() => new Error(`Не удалось загрузить логи с ограничением: ${error.message}`));
      })
    );
  }

}
