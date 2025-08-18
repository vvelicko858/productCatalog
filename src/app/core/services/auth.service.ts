import { Injectable } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  UserCredential,
  onAuthStateChanged,
  User
} from '@angular/fire/auth';
import { from, map, Observable, switchMap, catchError, BehaviorSubject, of, tap, timeout } from 'rxjs';
import { User as AppUser } from '../models/user';
import { doc, Firestore, setDoc, getDoc } from '@angular/fire/firestore';
import { DocumentReference } from '@angular/fire/firestore';

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
    private firestore: Firestore
  ) {
    // Проверяем, что Firebase инициализирован
    if (this.auth) {
      this.initializeAuth();
    } else {
      console.error('Firebase Auth not initialized');
      this.isInitialized = true;
    }
  }

  private initializeAuth() {
    try {

      // Устанавливаем таймаут для инициализации
      setTimeout(() => {
        if (!this.isInitialized) {
          console.log('Auth initialization timeout, setting initialized to true');
          this.isInitialized = true;
        }
      }, 3000);

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
      });

    } catch (error) {
      this.isInitialized = true;
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
      tap((cred) => {
      }),
      catchError((error) => {
        throw error;
      })
    );
  }

  /** выход из системы */
  logout(): Observable<void> {
    return from(this.auth.signOut()).pipe(
      tap(() => {
        // Очищаем локальные данные
        this.authStateSubject.next(false);
        this.currentUserSubject.next(null);
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
      })
    );
  }

  /** проверка роли пользователя */
  hasRole(role: string): boolean {
    const currentUser = this.currentUserSubject.value;
    return currentUser?.role === role;
  }

}
