import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogsService } from '../../../core/services/logs.service';
import { Log } from '../../../core/models/log';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { filter, take } from 'rxjs/operators';

@Component({
  selector: 'app-user-actions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-actions.component.html',
  styleUrl: './user-actions.component.scss'
})
export class UserActionsComponent implements OnInit, OnDestroy {
  logs: Log[] = [];
  loading = false;
  error: string | null = null;
  private subscription = new Subscription();

  constructor(
    private logsService: LogsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.authService.isAuthenticated$.pipe(
        filter(() => this.authService.isAuthInitialized()),
        take(1)
      ).subscribe(isAuthenticated => {
        if (isAuthenticated) {
          this.loadLogs();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadLogs(): void {
    this.loading = true;
    this.error = null;

    this.subscription.add(
      this.logsService.getLogsWithLimit(100).subscribe({
        next: (logs) => {
          this.logs = logs;
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Ошибка при загрузке логов: ' + (error.message || 'Неизвестная ошибка');
          this.loading = false;
        }
      })
    );
  }

  formatTimestamp(timestamp: Date): string {
    return new Date(timestamp).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'Admin':
        return 'role-admin';
      case 'Advanced':
        return 'role-advanced';
      case 'Simple':
        return 'role-simple';
      default:
        return 'role-default';
    }
  }

  refreshLogs(): void {
    this.loadLogs();
  }
}
