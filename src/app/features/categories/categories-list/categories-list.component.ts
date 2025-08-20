import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CategoriesService } from '../../../core/services/categories.service';
import { AuthService } from '../../../core/services/auth.service';
import { Category, UpdateCategoryDto } from '../../../core/models/category';
import { User } from '../../../core/models/user';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-categories-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './categories-list.component.html',
  styleUrl: './categories-list.component.scss'
})
export class CategoriesListComponent implements OnInit, OnDestroy {
  categories: Category[] = [];
  selectedCategory: Category | null = null;
  loading = false;
  error = '';
  currentUser: User | null = null;

  // Модальное окно редактирования категории
  showEditCategoryModal = false;
  isEditingCategory = false;
  editCategoryForm: FormGroup;

  private subscription = new Subscription();

  constructor(
    private categoriesService: CategoriesService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.editCategoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['', [Validators.required, Validators.minLength(5)]],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.loadCategories();

    // Подписываемся на изменения текущего пользователя
    this.subscription.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadCategories(): void {
    this.loading = true;
    this.error = '';

    this.subscription.add(
      this.categoriesService.getAllCategories().subscribe({
        next: (categories) => {
          this.categories = categories;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading categories:', error);
          this.error = 'Ошибка загрузки категорий';
          this.loading = false;
        }
      })
    );
  }

  selectCategory(category: Category): void {
    this.selectedCategory = category;
  }

  // Открыть модальное окно редактирования категории
  editCategory(category: Category, event: Event): void {
    event.stopPropagation(); // Предотвращаем выделение категории

    // Проверяем роль пользователя - простые пользователи не могут редактировать категории
    if (this.currentUser?.role === 'Simple') {
      alert('У вас нет прав для редактирования категорий. Обратитесь к администратору.');
      return;
    }

    this.selectedCategory = category;
    this.showEditCategoryModal = true;

    // Заполняем форму данными выбранной категории
    this.editCategoryForm.patchValue({
      name: category.name,
      description: category.description,
      isActive: category.isActive
    });
  }

  // Закрыть модальное окно редактирования
  closeEditCategoryModal(): void {
    this.showEditCategoryModal = false;
    this.editCategoryForm.reset();
    this.isEditingCategory = false;
    this.selectedCategory = null;
  }

  // Отправить форму редактирования категории
  onSubmitEditCategory(): void {
    // Проверяем роль пользователя - простые пользователи не могут редактировать категории
    if (this.currentUser?.role === 'Simple') {
      alert('У вас нет прав для редактирования категорий. Обратитесь к администратору.');
      return;
    }

    if (this.editCategoryForm.valid && this.selectedCategory) {
      this.isEditingCategory = true;

      const categoryData: UpdateCategoryDto = {
        name: this.editCategoryForm.get('name')?.value,
        description: this.editCategoryForm.get('description')?.value,
        isActive: this.editCategoryForm.get('isActive')?.value
      };

      // Получаем текущего пользователя для логирования
      this.authService.currentUser$.pipe(take(1)).subscribe((currentUser: User | null) => {
        if (currentUser) {
          // Используем метод с логированием
          this.subscription.add(
            this.categoriesService.updateCategoryWithLogging(this.selectedCategory!.id, categoryData, currentUser).subscribe({
              next: () => {
                // Перезагружаем категории из Firestore для избежания дублирования
                this.loadCategories();
                this.closeEditCategoryModal();
                alert(`Категория "${categoryData.name}" успешно обновлена`);
              },
              error: (error) => {
                console.error('Error updating category:', error);
                this.error = 'Ошибка обновления категории';
                this.isEditingCategory = false;
                alert('Произошла ошибка при обновлении категории');
              }
            })
          );
        } else {
          // Если пользователь не авторизован, обновляем категорию без логирования
          this.subscription.add(
            this.categoriesService.updateCategory(this.selectedCategory!.id, categoryData).subscribe({
              next: () => {
                // Перезагружаем категории из Firestore для избежания дублирования
                this.loadCategories();
                this.closeEditCategoryModal();
                alert(`Категория "${categoryData.name}" успешно обновлена`);
              },
              error: (error) => {
                console.error('Error updating category:', error);
                this.error = 'Ошибка обновления категории';
                this.isEditingCategory = false;
                alert('Произошла ошибка при обновлении категории');
              }
            })
          );
        }
      });
    } else {
      Object.keys(this.editCategoryForm.controls).forEach(key => {
        const control = this.editCategoryForm.get(key);
        if (control) {
          control.markAsTouched();
        }
      });
    }
  }

  deleteCategory(category: Category, event: Event): void {
    event.stopPropagation(); // Предотвращаем выделение категории

    // Проверяем роль пользователя - простые пользователи не могут удалять категории
    if (this.currentUser?.role === 'Simple') {
      alert('У вас нет прав для удаления категорий. Обратитесь к администратору.');
      return;
    }

    if (confirm(`Вы уверены, что хотите удалить категорию "${category.name}"? Все товары этой категории также будут удалены.`)) {
      this.loading = true;

      // Получаем текущего пользователя для логирования
      this.authService.currentUser$.pipe(take(1)).subscribe((currentUser: User | null) => {
        if (currentUser) {
          // Используем метод с логированием
          this.subscription.add(
            this.categoriesService.deleteCategoryWithProductsWithLogging(category.id, category.name, currentUser).subscribe({
              next: () => {
                // Удаляем категорию из локального массива
                this.categories = this.categories.filter(c => c.id !== category.id);

                // Снимаем выделение если удаляемая категория была выбрана
                if (this.selectedCategory?.id === category.id) {
                  this.selectedCategory = null;
                }

                this.loading = false;
                alert(`Категория "${category.name}" и все связанные товары успешно удалены`);
              },
              error: (error) => {
                console.error('Error deleting category:', error);
                this.error = 'Ошибка удаления категории';
                this.loading = false;
                alert('Произошла ошибка при удалении категории');
              }
            })
          );
        } else {
          // Если пользователь не авторизован, удаляем категорию без логирования
          this.subscription.add(
            this.categoriesService.deleteCategoryWithProducts(category.id, category.name).subscribe({
              next: () => {
                // Удаляем категорию из локального массива
                this.categories = this.categories.filter(c => c.id !== category.id);

                // Снимаем выделение если удаляемая категория была выбрана
                if (this.selectedCategory?.id === category.id) {
                  this.selectedCategory = null;
                }

                this.loading = false;
                alert(`Категория "${category.name}" и все связанные товары успешно удалены`);
              },
              error: (error) => {
                console.error('Error deleting category:', error);
                this.error = 'Ошибка удаления категории';
                this.loading = false;
                alert('Произошла ошибка при удалении категории');
              }
            })
          );
        }
      });
    }
  }

  // Геттеры для формы редактирования категории
  get editNameField() { return this.editCategoryForm.get('name'); }
  get editDescriptionField() { return this.editCategoryForm.get('description'); }
}
