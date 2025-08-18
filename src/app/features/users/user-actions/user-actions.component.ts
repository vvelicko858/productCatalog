import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-actions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-actions.component.html',
  styleUrl: './user-actions.component.scss'
})
export class UserActionsComponent {
  userActions = [
    { id: 1, user: 'admin', action: 'Создал продукт "Селедка"', timestamp: '2024-01-15 10:30' },
    { id: 2, user: 'manager', action: 'Обновил категорию "Еда"', timestamp: '2024-01-15 09:15' },
    { id: 3, user: 'user', action: 'Просмотрел каталог продуктов', timestamp: '2024-01-15 08:45' }
  ];
}
