import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

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
  private routerSubscription: Subscription | null = null;

  constructor(
    private authService: AuthService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;

      if (this.authService.isAuthInitialized()) {
        this.isLoading = false;
        this.updateActiveActionFromRoute();
      }
    });

    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      if (this.authService.isAuthInitialized()) {
        this.updateActiveActionFromRoute();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
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
    const route = `/dashboard/${action}`;
    this.router.navigate([route]);
  }

  private updateActiveActionFromRoute(): void {
    const url = this.router.url;

    if (url.includes('/dashboard/products') || url === '/dashboard') {
      this.activeAction = 'products';
    } else if (url.includes('/dashboard/categories')) {
      this.activeAction = 'categories';
    } else if (url.includes('/dashboard/user-actions')) {
      this.activeAction = 'user-actions';
    } else if (url.includes('/dashboard/users')) {
      this.activeAction = 'users';
    } else {
      this.activeAction = 'products';
    }
  }
}
