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
      this.initializeAuth();
    } else {
      this.isInitialized = true;
      this.authStateSubject.next(false);
      this.currentUserSubject.next(null);
    }
  }

  private initializeAuth() {
    try {
      // Устанавливаем таймаут для инициализации
      setTimeout(() => {
        if (!this.isInitialized) {
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
        if (firebaseUser) {
          // Пользователь авторизован
          this.authStateSubject.next(true);

          // Получаем дополнительные данные пользователя из Firestore
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
          this.authStateSubject.next(false);
          this.currentUserSubject.next(null);
        }

        this.isInitialized = true;
      }, (error) => {
        this.isInitialized = true;
        this.authStateSubject.next(false);
        this.currentUserSubject.next(null);
      });

    } catch (error) {
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


  /** проверка, инициализирована ли аутентификация */
  isAuthInitialized(): boolean {
    return this.isInitialized;
  }


}
