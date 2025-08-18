import { Route } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ProductsListComponent } from './features/products/products-list/products-list.component';
import { CategoriesListComponent } from './features/categories/categories-list/categories-list.component';
import { UserActionsComponent } from './features/users/user-actions/user-actions.component';
import { UsersListComponent } from './features/users/users-list/users-list.component';
import { authGuard } from './core/guards/auth.guard';
import { noAuthGuard } from './core/guards/no-auth.guard';

export const appRoutes: Route[] = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'auth',
    canActivate: [noAuthGuard],
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'products', pathMatch: 'full' },
      { path: 'products', component: ProductsListComponent },
      { path: 'categories', component: CategoriesListComponent },
      { path: 'user-actions', component: UserActionsComponent },
      { path: 'users', component: UsersListComponent }
    ]
  }
];
