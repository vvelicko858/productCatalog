import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user';
import { Subscription, combineLatest, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  isLoading = true;
  activeAction: string = 'products';
  private userSubscription: Subscription | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userSubscription = combineLatest([
      this.authService.currentUser$,
      this.authService.isAuthenticated$
    ]).pipe(
      map(([user, isAuthenticated]) => {
        this.currentUser = user;
        this.isLoading = false;
        return { user, isAuthenticated };
      }),
      catchError((error) => {
        console.error('Dashboard: Error in subscription:', error);
        this.isLoading = false;
        return of({ user: null, isAuthenticated: false });
      })
    ).subscribe();
    this.updateActiveActionFromRoute();
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/auth/login']);
      },
      error: (err) => {
        console.error('Logout error:', err);
      }
    });
  }

  getUserRoleDisplayName(role: string): string {
    switch (role) {
      case 'Admin': return 'Администратор';
      case 'Advanced': return 'Продвинутый пользователь';
      case 'Simple': return 'Обычный пользователь';
      default: return role;
    }
  }

  setActiveAction(action: string): void {
    this.activeAction = action;
    // Навигация к соответствующему маршруту
    this.router.navigate(['/dashboard', action]);
  }

  private updateActiveActionFromRoute(): void {
    const url = this.router.url;
    if (url.includes('/products')) {
      this.activeAction = 'products';
    } else if (url.includes('/categories')) {
      this.activeAction = 'categories';
    } else if (url.includes('/user-actions')) {
      this.activeAction = 'user-actions';
    } else if (url.includes('/users')) {
      this.activeAction = 'users';
    }
  }
}
