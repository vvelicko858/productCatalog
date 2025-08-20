import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy, writeBatch, where, setDoc } from '@angular/fire/firestore';
import { Observable, from, map, catchError, of, switchMap } from 'rxjs';
import { User } from '../models/user';
import { LogsService } from './logs.service';
import { Auth } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private readonly collectionName = 'users';

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private logsService: LogsService
  ) {}

  // Получить всех пользователей
  getAllUsers(): Observable<User[]> {
    const usersRef = collection(this.firestore, this.collectionName);
    const q = query(usersRef, orderBy('username'));

    return from(getDocs(q)).pipe(
      map(snapshot =>
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as User))
      ),
      catchError(error => {
        console.error('Error fetching users:', error);
        return of([]);
      })
    );
  }

  // Получить пользователя по ID
  getUserById(id: string): Observable<User | null> {
    const userRef = doc(this.firestore, this.collectionName, id);

    return from(getDoc(userRef)).pipe(
      map(doc => {
        if (doc.exists()) {
          return { id: doc.id, ...doc.data() } as User;
        }
        return null;
      }),
      catchError(error => {
        console.error('Error fetching user:', error);
        return of(null);
      })
    );
  }

  // Создать нового пользователя (только в Firestore, без Firebase Auth)
  createUserWithAuth(email: string, password: string, username: string, role: string = 'Simple'): Observable<User> {
    // Генерируем уникальный ID для пользователя
    const userId = this.generateUserId();

    const newUser: User = {
      id: userId,
      username: username,
      email: email,
      role: role as any,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Создаем пользователя только в Firestore
    const userRef = doc(this.firestore, this.collectionName, userId);
    return from(setDoc(userRef, newUser)).pipe(
      map(() => newUser),
      catchError(error => {
        console.error('Error creating user:', error);
        throw error;
      })
    );
  }

  // Создать нового пользователя (только в Firestore - для обратной совместимости)
  createUser(userData: Omit<User, 'id'>): Observable<User> {
    const usersRef = collection(this.firestore, this.collectionName);

    const newUser = {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return from(addDoc(usersRef, newUser)).pipe(
      map(docRef => ({
        id: docRef.id,
        ...newUser
      } as User)),
      catchError(error => {
        console.error('Error creating user:', error);
        throw error;
      })
    );
  }

  // Создать нового пользователя с логированием (только в Firestore)
  createUserWithAuthAndLogging(email: string, password: string, username: string, role: string, adminUser: User): Observable<User> {
    return this.createUserWithAuth(email, password, username, role).pipe(
      switchMap(user => {
        // Логируем создание пользователя
        this.logsService.logUserAction(
          adminUser,
          'Создание пользователя администратором',
          `Администратор ${adminUser.username} создал пользователя "${user.username}" с email "${user.email}" и ролью "${user.role}" в Firestore. Пользователь сможет войти в систему при первом входе.`
        ).pipe(
          catchError(logError => {
            console.warn('Ошибка логирования создания пользователя:', logError);
            return of(null);
          })
        ).subscribe(); // Не блокируем основной поток
        return of(user);
      })
    );
  }

  // Обновить пользователя
  updateUser(id: string, userData: Partial<User>): Observable<void> {
    const userRef = doc(this.firestore, this.collectionName, id);

    const updateData = {
      ...userData,
      updatedAt: new Date()
    };

    return from(updateDoc(userRef, updateData)).pipe(
      catchError(error => {
        console.error('Error updating user:', error);
        throw error;
      })
    );
  }

  // Обновить пользователя с логированием
  updateUserWithLogging(id: string, userData: Partial<User>, adminUser: User): Observable<void> {
    return this.updateUser(id, userData).pipe(
      switchMap(() => {
        // Формируем детальное описание изменений
        const changes = [];
        if (userData.username !== undefined) changes.push(`имя: "${userData.username}"`);
        if (userData.email !== undefined) changes.push(`email: "${userData.email}"`);
        if (userData.role !== undefined) changes.push(`роль: "${userData.role}"`);
        if (userData.isBlocked !== undefined) changes.push(`статус блокировки: ${userData.isBlocked ? 'заблокирован' : 'разблокирован'}`);

        const changeDescription = changes.length > 0 ? `Изменены поля: ${changes.join(', ')}` : 'Обновлен пользователь';

        // Логируем обновление пользователя
        this.logsService.logUserAction(
          adminUser,
          'Обновление пользователя',
          `${changeDescription} (ID: ${id})`
        ).pipe(
          catchError(logError => {
            console.warn('Ошибка логирования обновления пользователя:', logError);
            return of(null);
          })
        ).subscribe(); // Не блокируем основной поток
        return of(void 0);
      })
    );
  }

  // Удалить пользователя (только из Firestore)
  deleteUserFromFirestore(id: string): Observable<void> {
    return this.getUserById(id).pipe(
      switchMap(user => {
        if (!user) {
          throw new Error('Пользователь не найден');
        }

        // Создаем batch для атомарных операций
        const batch = writeBatch(this.firestore);

        // 1. Удаляем пользователя из Firestore
        const userRef = doc(this.firestore, this.collectionName, id);
        batch.delete(userRef);

        // 2. НЕ удаляем логи пользователя - оставляем для аудита
        // Логи важны для отслеживания действий пользователя даже после удаления

        // 3. ВАЖНО: Удаление из Firebase Auth невозможно в клиентском коде
        // Для полного удаления нужен Firebase Admin SDK на сервере
        // Здесь мы удаляем только профиль из Firestore

        // Если удаляем текущего пользователя, сначала разлогиниваем
        if (this.auth.currentUser && this.auth.currentUser.uid === id) {
          return from(this.auth.signOut()).pipe(
            switchMap(() => {
              // Выполняем batch операцию (удаление из Firestore)
              return from(batch.commit());
            })
          );
        } else {
          // Просто выполняем batch операцию (удаление из Firestore)
          return from(batch.commit());
        }
      }),
      catchError(error => {
        console.error('Error deleting user from Firestore:', error);
        throw error;
      })
    );
  }

  // Удалить пользователя с логированием
  deleteUserWithLogging(id: string, adminUser: User): Observable<void> {
    return this.getUserById(id).pipe(
      switchMap(user => {
        if (!user) {
          throw new Error('Пользователь не найден');
        }

        return this.deleteUserFromFirestore(id).pipe(
          switchMap(() => {
            // Логируем удаление пользователя
            this.logsService.logUserAction(
              adminUser,
              'Удаление пользователя',
              `Удален пользователь "${user.username}" (${user.email}) с ID: ${id}. Профиль удален из Firestore, логи сохранены для аудита. ПРИМЕЧАНИЕ: Для полного удаления из Firebase Auth требуется серверная часть.`
            ).pipe(
              catchError(logError => {
                console.warn('Ошибка логирования удаления пользователя:', logError);
                return of(null);
              })
            ).subscribe(); // Не блокируем основной поток
            return of(void 0);
          })
        );
      })
    );
  }

  // Блокировать/разблокировать пользователя
  toggleUserBlock(id: string, isBlocked: boolean): Observable<void> {
    return this.updateUser(id, { isBlocked });
  }

  // Блокировать/разблокировать пользователя с логированием
  toggleUserBlockWithLogging(id: string, isBlocked: boolean, adminUser: User): Observable<void> {
    return this.toggleUserBlock(id, isBlocked).pipe(
      switchMap(() => {
        const action = isBlocked ? 'Блокировка' : 'Разблокировка';
        const status = isBlocked ? 'заблокирован' : 'разблокирован';

        this.logsService.logUserAction(
          adminUser,
          `${action} пользователя`,
          `Пользователь (ID: ${id}) ${status}`
        ).pipe(
          catchError(logError => {
            console.warn('Ошибка логирования блокировки/разблокировки пользователя:', logError);
            return of(null);
          })
        ).subscribe(); // Не блокируем основной поток
        return of(void 0);
      })
    );
  }

  // Изменить роль пользователя
  changeUserRole(id: string, newRole: string): Observable<void> {
    return this.updateUser(id, { role: newRole as any });
  }


  /** сбросить пароль пользователя через email */
  resetUserPassword(email: string): Observable<void> {
    // Отправляем email для сброса пароля
    return from(import('@angular/fire/auth').then(m => m.sendPasswordResetEmail(this.auth, email))).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  /** сбросить пароль пользователя с логированием */
  resetUserPasswordWithLogging(email: string, adminUser: User): Observable<void> {
    return this.resetUserPassword(email).pipe(
      switchMap(() => {
        // Логируем сброс пароля
        this.logsService.logUserAction(
          adminUser,
          'Сброс пароля пользователя',
          `Отправлен email для сброса пароля пользователю с email: ${email}`
        ).pipe(
          catchError(logError => {
            console.warn('Ошибка логирования сброса пароля:', logError);
            return of(null);
          })
        ).subscribe(); // Не блокируем основной поток
        return of(void 0);
      })
    );
  }



  // Генерируем уникальный ID для пользователя
  private generateUserId(): string {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
