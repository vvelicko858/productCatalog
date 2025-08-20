import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { Router } from '@angular/router';
import {AuthService} from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  passwordVisible = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  togglePassword(input: HTMLInputElement): void {
    this.passwordVisible = !this.passwordVisible;
    input.type = this.passwordVisible ? 'text' : 'password';
  }


  register(): void {
    console.log('register');
    this.router.navigate(['/auth/register']);
  }

  onSubmit(): void {
    if (this.loginForm.valid) {

       this.authService.login(this.loginForm.value.email, this.loginForm.value.password).subscribe({
         next: (user) => {
           console.log('Login success:', user.user.uid);
           // 👉 редирект на dashboard
           this.router.navigate(['/dashboard']);
         },
         error: (err) => {
           console.error('Login error:', err);
           
           // Проверяем, связана ли ошибка с блокировкой аккаунта
           if (err instanceof Error && err.message.includes('заблокирован')) {
             alert('Ваш аккаунт заблокирован. Обратитесь к администратору для разблокировки.');
           } else {
             alert('Ошибка входа в систему. Проверьте email и пароль.');
           }
         }
       });
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}
