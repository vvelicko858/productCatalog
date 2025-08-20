import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { map, take, filter } from 'rxjs/operators';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Если аутентификация не инициализирована, ждем
  if (!authService.isAuthInitialized()) {
    return new Promise((resolve) => {
      const checkInit = () => {
        if (authService.isAuthInitialized()) {
          resolve(authService.currentUser$.pipe(take(1)).toPromise().then(user => {
            if (!user) {
              router.navigate(['/auth/login']);
              return false;
            }
            return checkUserRole(user, state, router);
          }));
        } else {
          setTimeout(checkInit, 100);
        }
      };
      checkInit();
    });
  }

  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      if (!user) {
        router.navigate(['/auth/login']);
        return false;
      }
      return checkUserRole(user, state, router);
    })
  );
};

function checkUserRole(user: any, state: any, router: any): boolean {
  // Проверяем роль пользователя
  switch (user.role) {
    case 'Simple':
      // Простой пользователь не может переходить на страницы логи и пользователей
      if (state.url.includes('/user-actions') || state.url.includes('/users')) {
        router.navigate(['/dashboard/products']);
        return false;
      }
      return true;

    case 'Advanced':
      // Продвинутый пользователь может управлять продуктами и категориями, но не пользователями
      if (state.url.includes('/user-actions') || state.url.includes('/users')) {
        router.navigate(['/dashboard/products']);
        return false;
      }
      return true;

    case 'Admin':
      // Администраторы имеют полный доступ
      return true;

    default:
      router.navigate(['/dashboard/products']);
      return false;
  }
}
