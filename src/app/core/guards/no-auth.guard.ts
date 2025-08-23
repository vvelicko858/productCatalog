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
    return true;
  }

  return authService.isAuthenticated$.pipe(
    take(1),
    map(isAuthenticated => {
      if (isAuthenticated) {
        // Если пользователь авторизован, перенаправляем на dashboard
        router.navigate(['/dashboard']);
        return false;
      }
      return true;
    }),
    catchError((error) => {
      return of(true);
    })
  );
};
