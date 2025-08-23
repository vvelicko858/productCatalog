import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { map, take, filter, catchError, switchMap } from 'rxjs/operators';
import { of, timer } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Если аутентификация не инициализирована, ждем
  if (!authService.isAuthInitialized()) {
    return new Promise((resolve) => {
      const checkInit = () => {
        if (authService.isAuthInitialized()) {
          resolve(authService.isAuthenticated$.pipe(take(1)).toPromise().then(isAuth => {
            if (!isAuth) {
              router.navigate(['/auth/login']);
              return false;
            }
            return true;
          }));
        } else {
          setTimeout(checkInit, 100);
        }
      };
      checkInit();
    });
  }

  return authService.isAuthenticated$.pipe(
    take(1),
    map(isAuthenticated => {
      if (isAuthenticated) {
        return true;
      }
      router.navigate(['/auth/login']);
      return false;
    }),
    catchError((error) => {
      router.navigate(['/auth/login']);
      return of(false);
    })
  );
};
