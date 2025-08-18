import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { map, take, filter, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Если аутентификация еще не инициализирована, разрешаем доступ
  if (!authService.isAuthInitialized()) {
    console.log('Auth guard: Auth not initialized yet, allowing access');
    return true;
  }

  return authService.isAuthenticated$.pipe(
    take(1),
    map(isAuthenticated => {
      console.log('Auth guard check - isAuthenticated:', isAuthenticated);
      if (isAuthenticated) {
        // Если пользователь авторизован, разрешаем доступ к dashboard
        return true;
      }
      // Если не авторизован, перенаправляем на login
      console.log('Redirecting to login from auth guard');
      router.navigate(['/auth/login']);
      return false;
    }),
    catchError((error) => {
      console.error('Auth guard error:', error);
      // В случае ошибки перенаправляем на login
      router.navigate(['/auth/login']);
      return of(false);
    })
  );
};
