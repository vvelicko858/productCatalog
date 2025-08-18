import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss'
})
export class UsersListComponent {
  users = [
    { id: 1, username: 'admin', email: 'admin@example.com', role: 'Admin', isBlocked: false },
    { id: 2, username: 'manager', email: 'manager@example.com', role: 'Advanced', isBlocked: false },
    { id: 3, username: 'user1', email: 'user1@example.com', role: 'Simple', isBlocked: false },
    { id: 4, username: 'user2', email: 'user2@example.com', role: 'Simple', isBlocked: true }
  ];
}
