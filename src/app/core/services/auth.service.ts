import { Injectable } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  UserCredential,
  onAuthStateChanged,
  User
} from '@angular/fire/auth';
import { from, map, Observable, switchMap, catchError, BehaviorSubject, of, tap, timeout, take } from 'rxjs';
import { User as AppUser } from '../models/user';
import { doc, Firestore, setDoc, getDoc } from '@angular/fire/firestore';
import { DocumentReference } from '@angular/fire/firestore';
import { LogsService } from './logs.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authStateSubject = new BehaviorSubject<boolean>(false);
  private currentUserSubject = new BehaviorSubject<AppUser | null>(null);
  private isInitialized = false;

  public isAuthenticated$ = this.authStateSubject.asObservable();
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private logsService: LogsService
  ) {
    // Проверяем, что Firebase инициализирован
    if (this.auth) {
      console.log('AuthService: Firebase Auth available, initializing...');
      this.initializeAuth();
    } else {
      console.error('AuthService: Firebase Auth not initialized');
      this.isInitialized = true;
      this.authStateSubject.next(false);
      this.currentUserSubject.next(null);
    }
  }

  private initializeAuth() {
    try {
      console.log('Initializing auth...');

      // Устанавливаем таймаут для инициализации
      setTimeout(() => {
        if (!this.isInitialized) {
          console.log('Auth initialization timeout, setting initialized to true');
          this.isInitialized = true;
          // Если после таймаута пользователь не определен, устанавливаем false
          if (!this.auth.currentUser) {
            this.authStateSubject.next(false);
            this.currentUserSubject.next(null);
          }
        }
      }, 3000); // Возвращаем таймаут к 3 секундам

      // Подписываемся на изменения состояния аутентификации
      onAuthStateChanged(this.auth, async (firebaseUser) => {
        console.log('Auth state changed:', firebaseUser ? 'User logged in' : 'User logged out');

        if (firebaseUser) {
          // Пользователь авторизован
          this.authStateSubject.next(true);

          // Получаем дополнительные данные пользователя из Firestore
          try {
            const userDoc = await getDoc(doc(this.firestore, `users/${firebaseUser.uid}`));
            if (userDoc.exists()) {
              const userData = userDoc.data() as AppUser;
              console.log('User data loaded from Firestore:', userData);
              this.currentUserSubject.next(userData);
            } else {
              // Если документ не найден, создаем базового пользователя
              const basicUser: AppUser = {
                id: firebaseUser.uid,
                username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                email: firebaseUser.email || '',
                role: 'Simple',
                isBlocked: false
              };
              console.log('Creating basic user:', basicUser);
              this.currentUserSubject.next(basicUser);
            }
          } catch (error) {
            console.error('Error loading user data from Firestore:', error);
            // В случае ошибки создаем базового пользователя
            const basicUser: AppUser = {
              id: firebaseUser.uid,
              username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: 'Simple',
              isBlocked: false
            };
            this.currentUserSubject.next(basicUser);
          }
        } else {
          // Пользователь не авторизован
          console.log('No user authenticated');
          this.authStateSubject.next(false);
          this.currentUserSubject.next(null);
        }

        this.isInitialized = true;
        console.log('Auth initialization completed');
      }, (error) => {
        console.error('Auth state change error:', error);
        this.isInitialized = true;
        this.authStateSubject.next(false);
        this.currentUserSubject.next(null);
      });

    } catch (error) {
      console.error('Auth initialization error:', error);
      this.isInitialized = true;
      this.authStateSubject.next(false);
      this.currentUserSubject.next(null);
    }
  }





  /** регистрирует нового пользователя в Firebase Authentication и создает профиль в Firestore*/
  register(email: string, password: string, username: string): Observable<AppUser> {
    return from(createUserWithEmailAndPassword(this.auth, email, password)).pipe(
      switchMap((cred: UserCredential) => {
        const newUser: AppUser = {
          id: cred.user.uid,
          username: username,
          email: email,
          role: "Simple",
          isBlocked: false
        };

        const userRef: DocumentReference = doc(this.firestore, `users/${cred.user.uid}`);
        return from(setDoc(userRef, newUser)).pipe(
          switchMap(() => {
            // Логируем регистрацию
            return this.logsService.logUserAction(newUser, 'Регистрация нового пользователя', `Создан аккаунт для ${email}`).pipe(
              catchError(logError => {
                console.warn('Ошибка логирования регистрации:', logError);
                return of(null); // Продолжаем выполнение даже при ошибке логирования
              })
            );
          }),
          map(() => newUser)
        );
      }),
      catchError((error) => {
        throw error;
      })
    );
  }

  /** авторизация пользователя*/
  login(email: string, password: string): Observable<UserCredential> {
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      switchMap((cred) => {
        // Получаем данные пользователя для логирования
        return this.currentUser$.pipe(
          take(1),
          switchMap(user => {
            if (user) {
              // Логируем вход в систему
              this.logsService.logUserAction(user, 'Вход в систему', `Пользователь ${user.username} вошел в систему`).pipe(
                catchError(logError => {
                  console.warn('Ошибка логирования входа:', logError);
                  return of(null);
                })
              ).subscribe(); // Не блокируем основной поток
            } else {
              // Если пользователь еще не инициализирован, логируем с базовыми данными
              const basicUser: AppUser = {
                id: cred.user.uid,
                username: cred.user.displayName || cred.user.email?.split('@')[0] || 'User',
                email: cred.user.email || '',
                role: 'Simple',
                isBlocked: false
              };
              
              this.logsService.logUserAction(basicUser, 'Вход в систему', `Пользователь ${basicUser.username} вошел в систему`).pipe(
                catchError(logError => {
                  console.warn('Ошибка логирования входа:', logError);
                  return of(null);
                })
              ).subscribe();
            }
            return of(cred);
          })
        );
      }),
      catchError((error) => {
        throw error;
      })
    );
  }

  /** выход из системы */
  logout(): Observable<void> {
    const currentUser = this.currentUserSubject.value;
    
    return from(this.auth.signOut()).pipe(
      tap(() => {
        // Очищаем локальные данные
        this.authStateSubject.next(false);
        this.currentUserSubject.next(null);
      }),
      switchMap(() => {
        // Логируем выход из системы
        if (currentUser) {
          this.logsService.logUserAction(currentUser, 'Выход из системы', `Пользователь ${currentUser.username} вышел из системы`).pipe(
            catchError(logError => {
              console.warn('Ошибка логирования выхода:', logError);
              return of(null);
            })
          ).subscribe(); // Не блокируем основной поток
        }
        return of(void 0);
      }),
      catchError((error) => {
        throw error;
      })
    );
  }

  /** получение текущего пользователя Firebase */
  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  /** проверка, инициализирована ли аутентификация */
  isAuthInitialized(): boolean {
    return this.isInitialized;
  }

  /** обновление данных пользователя из Firebase */
  private async updateUserFromFirebase(firebaseUser: User): Promise<void> {
    try {
      const userDoc = await getDoc(doc(this.firestore, `users/${firebaseUser.uid}`));
      if (userDoc.exists()) {
        const userData = userDoc.data() as AppUser;
        this.currentUserSubject.next(userData);
      } else {
        // Если документ не найден, создаем базового пользователя
        const basicUser: AppUser = {
          id: firebaseUser.uid,
          username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          email: firebaseUser.email || '',
          role: 'Simple',
          isBlocked: false
        };
        this.currentUserSubject.next(basicUser);
      }
    } catch (error) {
      console.error('Error updating user from Firebase:', error);
      // В случае ошибки создаем базового пользователя
      const basicUser: AppUser = {
        id: firebaseUser.uid,
        username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        email: firebaseUser.email || '',
        role: 'Simple',
        isBlocked: false
      };
      this.currentUserSubject.next(basicUser);
    }
  }

  /** обновление данных пользователя в Firestore */
  updateUserData(userData: Partial<AppUser>): Observable<void> {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) {
      return of(void 0);
    }

    const updatedUser = { ...currentUser, ...userData };
    const userRef = doc(this.firestore, `users/${currentUser.id}`);

    return from(setDoc(userRef, updatedUser, { merge: true })).pipe(
      map(() => {
        this.currentUserSubject.next(updatedUser);
        
        // Логируем обновление профиля
        this.logsService.logUserAction(
          updatedUser, 
          'Обновление профиля', 
          `Пользователь ${updatedUser.username} обновил свой профиль`
        ).pipe(
          catchError(logError => {
            console.warn('Ошибка логирования обновления профиля:', logError);
            return of(null);
          })
        ).subscribe();
      })
    );
  }

  /** проверка роли пользователя */
  hasRole(role: string): boolean {
    const currentUser = this.currentUserSubject.value;
    return currentUser?.role === role;
  }

}
