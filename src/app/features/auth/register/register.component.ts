import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from "@angular/router";
import { NgIf } from "@angular/common";
import { AuthService } from "../../../core/services/auth.service";

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgIf
  ],
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  passwordVisible = false;
  confirmPasswordVisible = false;
  submitting = false;

  constructor(private fb: FormBuilder, private router: Router, private auth: AuthService) { }

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordsMatchValidator });
  }

  private passwordsMatchValidator(group: AbstractControl | null) {
    if (!group) return null;
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { mismatch: true };
  }

  togglePassword(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  toggleConfirmPassword(): void {
    this.confirmPasswordVisible = !this.confirmPasswordVisible;
  }

  goToLogin(): void {
    console.log('goToLogin');
    this.router.navigate(['/auth/login']);
  }

  onSubmit(): void {
    this.registerForm.markAllAsTouched();
    if (this.registerForm.invalid) return;

    this.submitting = true;
    const payload = {
      username: this.registerForm.value.username,
      email: this.registerForm.value.email,
      password: this.registerForm.value.password
    };

    this.auth.register(payload.email, payload.password, payload.username).subscribe({
      next: (newUser) => {
        console.log('Пользователь зарегистрирован:', newUser);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        alert(err.message);
        this.submitting = false;
      },
      complete: () => {
        this.submitting = false;
      }
    });
  }

  get username() { return this.registerForm.get('username'); }
  get email() { return this.registerForm.get('email'); }
  get password() { return this.registerForm.get('password'); }
  get confirmPassword() { return this.registerForm.get('confirmPassword'); }
}
