import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { map, take, filter, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export const noAuthGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Если аутентификация еще не инициализирована, разрешаем доступ
  if (!authService.isAuthInitialized()) {
    console.log('No-auth guard: Auth not initialized yet, allowing access');
    return true;
  }

  return authService.isAuthenticated$.pipe(
    take(1),
    map(isAuthenticated => {
      console.log('No-auth guard check - isAuthenticated:', isAuthenticated);
      if (isAuthenticated) {
        // Если пользователь авторизован, перенаправляем на dashboard
        console.log('Redirecting to dashboard from no-auth guard');
        router.navigate(['/dashboard']);
        return false;
      }
      // Если не авторизован, разрешаем доступ к auth страницам
      return true;
    }),
    catchError((error) => {
      console.error('No-auth guard error:', error);
      // В случае ошибки разрешаем доступ к auth страницам
      return of(true);
    })
  );
};
