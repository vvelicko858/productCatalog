import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UsersService } from '../../../core/services/users.service';
import { AuthService } from '../../../core/services/auth.service';
import { User, UserRole } from '../../../core/models/user';
import { Subscription, of } from 'rxjs';
import { take, filter, switchMap, map } from 'rxjs/operators';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss'
})
export class UsersListComponent implements OnInit, OnDestroy {
  users: User[] = [];
  selectedUser: User | null = null;
  loading = false;
  error = '';

  showAddUserModal = false;
  showEditUserModal = false;


  isAddingUser = false;
  isEditingUser = false;
  addUserForm!: FormGroup;
  editUserForm!: FormGroup;

  userRoles: UserRole[] = ['Simple', 'Advanced', 'Admin'];

  private subscription = new Subscription();

  constructor(
    private usersService: UsersService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.subscription.add(
      this.authService.isAuthenticated$.pipe(
        filter(() => this.authService.isAuthInitialized()),
        take(1)
      ).subscribe(isAuthenticated => {
        if (isAuthenticated) {
          this.loadUsers();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private initializeForms(): void {
    this.addUserForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['Simple', Validators.required],
      isBlocked: [false]
    });

    this.editUserForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      role: ['Simple', Validators.required],
      isBlocked: [false]
    });


  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';

    this.subscription.add(
      this.usersService.getAllUsers().subscribe({
        next: (users) => {
          this.users = users;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading users:', error);
          this.error = 'Ошибка загрузки пользователей';
          this.loading = false;
        }
      })
    );
  }

  selectUser(user: User): void {
    this.selectedUser = user;
  }

  addUser(): void {
    this.showAddUserModal = true;
    this.addUserForm.reset();
    this.addUserForm.patchValue({ role: 'Simple', isBlocked: false });
  }

  closeAddUserModal(): void {
    this.showAddUserModal = false;
    this.addUserForm.reset();
    this.isAddingUser = false;
  }

  onSubmitAddUser(): void {
    if (this.addUserForm.valid) {
      this.isAddingUser = true;

      const username = this.addUserForm.get('username')?.value;
      const email = this.addUserForm.get('email')?.value;
      const password = this.addUserForm.get('password')?.value;
      const role = this.addUserForm.get('role')?.value;
      const isBlocked = this.addUserForm.get('isBlocked')?.value;

      this.authService.currentUser$.pipe(take(1)).subscribe((currentUser: User | null) => {
        if (currentUser) {
          this.subscription.add(
            this.authService.register(email, password, username).pipe(
              switchMap((newUser) => {
                if (isBlocked) {
                  return this.usersService.updateUser(newUser.id, { isBlocked: true }).pipe(
                    map(() => newUser)
                  );
                }
                return of(newUser);
              }),
              switchMap((newUser) => {
                if (role !== 'Simple') {
                  return this.usersService.updateUser(newUser.id, { role }).pipe(
                    map(() => newUser)
                  );
                }
                return of(newUser);
              })
            ).subscribe({
              next: (newUser) => {
                this.loadUsers();
                this.closeAddUserModal();
                alert(`Пользователь "${username}" успешно создан в системе!\n\nEmail: ${email}\nПароль: ${password}\n\nНовый пользователь сможет войти в систему используя свой email и пароль.`);
              },
              error: (error) => {
                this.error = 'Ошибка при создании пользователя';
                this.isAddingUser = false;

                if (error.code === 'auth/email-already-in-use') {
                  alert('Пользователь с таким email уже существует в Firebase Auth');
                } else if (error.code === 'auth/weak-password') {
                  alert('Пароль слишком слабый. Используйте минимум 6 символов');
                } else if (error.code === 'auth/invalid-email') {
                  alert('Неверный формат email адреса');
                } else {
                  alert('Произошла ошибка при создании пользователя: ' + (error.message || error));
                }
              }
            })
          );
        } else {
          this.error = 'Ошибка: пользователь не авторизован';
          this.isAddingUser = false;
          alert('Ошибка: пользователь не авторизован. Войдите в систему для создания новых пользователей.');
        }
      });
    } else {
      Object.keys(this.addUserForm.controls).forEach(key => {
        const control = this.addUserForm.get(key);
        if (control) {
          control.markAsTouched();
        }
      });
    }
  }

  editUser(user: User, event: Event): void {
    event.stopPropagation();

    this.selectedUser = user;
    this.showEditUserModal = true;

    this.editUserForm.patchValue({
      username: user.username,
      email: user.email,
      role: user.role,
      isBlocked: user.isBlocked || false
    });
  }

  closeEditUserModal(): void {
    this.showEditUserModal = false;
    this.editUserForm.reset();
    this.isEditingUser = false;
    this.selectedUser = null;
  }

  onSubmitEditUser(): void {
    if (this.editUserForm.valid && this.selectedUser) {
      this.isEditingUser = true;

      const userData = {
        username: this.editUserForm.get('username')?.value,
        email: this.editUserForm.get('email')?.value,
        role: this.editUserForm.get('role')?.value,
        isBlocked: this.editUserForm.get('isBlocked')?.value
      };

      this.authService.currentUser$.pipe(take(1)).subscribe((currentUser: User | null) => {
        if (currentUser) {
          this.subscription.add(
            this.usersService.updateUserWithLogging(this.selectedUser!.id, userData, currentUser).subscribe({
              next: () => {
                this.loadUsers();
                this.closeEditUserModal();
                alert(`Пользователь "${userData.username}" успешно обновлен`);
              },
              error: (error) => {
                this.error = 'Ошибка обновления пользователя';
                this.isEditingUser = false;
                alert('Произошла ошибка при обновлении пользователя');
              }
            })
          );
        } else {
          this.subscription.add(
            this.usersService.updateUser(this.selectedUser!.id, userData).subscribe({
              next: () => {
                this.loadUsers();
                this.closeEditUserModal();
                alert(`Пользователь "${userData.username}" успешно обновлен`);
              },
              error: (error) => {
                this.error = 'Ошибка обновления пользователя';
                this.isEditingUser = false;
                alert('Произошла ошибка при обновлении пользователя');
              }
            })
          );
        }
      });
    } else {
      Object.keys(this.editUserForm.controls).forEach(key => {
        const control = this.editUserForm.get(key);
        if (control) {
          control.markAsTouched();
        }
      });
    }
  }


  resetPassword(user: User, event: Event): void {
    event.stopPropagation();

    if (confirm(`Вы уверены, что хотите сбросить пароль для пользователя "${user.username}"?\n\nБудет отправлен email на адрес ${user.email} со ссылкой для сброса пароля.`)) {
      this.loading = true;

      this.authService.currentUser$.pipe(take(1)).subscribe((currentUser: User | null) => {
        if (currentUser) {
          this.subscription.add(
            this.usersService.resetUserPasswordWithLogging(user.email, currentUser).subscribe({
              next: () => {
                this.loading = false;
                alert(`Пароль для пользователя "${user.username}" успешно сброшен. Email с инструкциями отправлен на адрес ${user.email}`);
              },
              error: (error) => {
                this.error = 'Ошибка сброса пароля';
                this.loading = false;

                if (error.code === 'auth/user-not-found') {
                  alert('Пользователь с таким email не найден в Firebase Auth');
                } else if (error.code === 'auth/invalid-email') {
                  alert('Неверный формат email адреса');
                } else {
                  alert('Произошла ошибка при сбросе пароля: ' + error.message);
                }
              }
            })
          );
        } else {
          this.subscription.add(
            this.usersService.resetUserPassword(user.email).subscribe({
              next: () => {
                this.loading = false;
                alert(`Пароль для пользователя "${user.username}" успешно сброшен. Email с инструкциями отправлен на адрес ${user.email}`);
              },
              error: (error) => {
                this.error = 'Ошибка сброса пароля';
                this.loading = false;

                if (error.code === 'auth/user-not-found') {
                  alert('Пользователь с таким email не найден в Firebase Auth');
                } else if (error.code === 'auth/invalid-email') {
                  alert('Неверный формат email адреса');
                } else {
                  alert('Произошла ошибка при сбросе пароля: ' + error.message);
                }
              }
            })
          );
        }
      });
    }
  }

  toggleUserBlock(user: User, event: Event): void {
    event.stopPropagation();

    const newBlockStatus = !user.isBlocked;
    const action = newBlockStatus ? 'заблокировать' : 'разблокировать';

    if (confirm(`Вы уверены, что хотите ${action} пользователя "${user.username}"?`)) {
      this.loading = true;

      this.authService.currentUser$.pipe(take(1)).subscribe((currentUser: User | null) => {
        if (currentUser) {
          this.subscription.add(
            this.usersService.toggleUserBlockWithLogging(user.id, newBlockStatus, currentUser).subscribe({
              next: () => {
                this.loadUsers();
                alert(`Пользователь "${user.username}" успешно ${newBlockStatus ? 'заблокирован' : 'разблокирован'}`);
              },
              error: (error) => {
                this.error = 'Ошибка изменения статуса блокировки';
                this.loading = false;
                alert('Произошла ошибка при изменении статуса блокировки');
              }
            })
          );
        } else {
          this.subscription.add(
            this.usersService.toggleUserBlock(user.id, newBlockStatus).subscribe({
              next: () => {
                this.loadUsers();
                alert(`Пользователь "${user.username}" успешно ${newBlockStatus ? 'заблокирован' : 'разблокирован'}`);
              },
              error: (error) => {
                this.error = 'Ошибка изменения статуса блокировки';
                this.loading = false;
                alert('Произошла ошибка при изменении статуса блокировки');
              }
            })
          );
        }
      });
    }
  }

  deleteUser(user: User, event: Event): void {
    event.stopPropagation();

    if (confirm(`Вы уверены, что хотите удалить пользователя "${user.username}"?\n\nЭто действие:\n• Удалит профиль пользователя из Firestore\n• Разлогинит пользователя (если он авторизован)\n• Сохранит все логи для аудита\n• НЕЛЬЗЯ отменить!`)) {
      this.loading = true;

      this.authService.currentUser$.pipe(take(1)).subscribe((currentUser: User | null) => {
        if (currentUser) {
          this.subscription.add(
            this.usersService.deleteUserWithLogging(user.id, currentUser).subscribe({
              next: () => {
                this.loadUsers();
                alert(`Пользователь "${user.username}" успешно удален. Профиль удален из Firestore, логи сохранены для аудита.`);
              },
              error: (error) => {
                this.error = 'Ошибка удаления пользователя';
                this.loading = false;
                alert('Произошла ошибка при удалении пользователя: ' + error.message);
              }
            })
          );
        } else {
          this.subscription.add(
            this.usersService.deleteUserFromFirestore(user.id).subscribe({
              next: () => {
                this.loadUsers();
                alert(`Пользователь "${user.username}" успешно удален. Профиль удален из Firestore, логи сохранены для аудита.`);
              },
              error: (error) => {
                this.error = 'Ошибка удаления пользователя';
                this.loading = false;
                alert('Произошла ошибка при удалении пользователя: ' + error.message);
              }
            })
          );
        }
      });
    }
  }

  get addUsernameField() { return this.addUserForm.get('username'); }
  get addEmailField() { return this.addUserForm.get('email'); }
  get addPasswordField() { return this.addUserForm.get('password'); }

  get editUsernameField() { return this.editUserForm.get('username'); }
  get editEmailField() { return this.editUserForm.get('email'); }


}
