import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'productCatalog';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // Инициализируем аутентификацию при запуске приложения
    console.log('App component initialized');
  }
}
