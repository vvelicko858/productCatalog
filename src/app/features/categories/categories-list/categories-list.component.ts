import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-categories-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './categories-list.component.html',
  styleUrl: './categories-list.component.scss'
})
export class CategoriesListComponent {
  categories = [
    { id: 1, name: 'Еда', description: 'Продукты питания' },
    { id: 2, name: 'Вкусности', description: 'Сладости и десерты' },
    { id: 3, name: 'Вода', description: 'Напитки и жидкости' },
    { id: 4, name: 'Электроника', description: 'Технические устройства' }
  ];

  selectedCategory: any = null;

  selectCategory(category: any): void {
    this.selectedCategory = category;
  }
}
