import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription, combineLatest, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, map } from 'rxjs/operators';
import { ProductsService } from '../../../core/services/products.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { AuthService } from '../../../core/services/auth.service';
import { Product, CreateProductDto } from '../../../core/models/product';
import { Category, CreateCategoryDto } from '../../../core/models/category';
import { User } from '../../../core/models/user';
import { take } from 'rxjs/operators';
import { FormatPricePipe } from '../../../shared/pipes/format-price.pipe';
import { TruncatePipe } from '../../../shared/pipes/truncate.pipe';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FormatPricePipe],
  templateUrl: './products-list.component.html',
  styleUrl: './products-list.component.scss'
})
export class ProductsListComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  categories: string[] = [];
  selectedProduct: Product | null = null;
  isLoading = false;
  error: string | null = null;
  currentUser: User | null = null;

  // Модальное окно добавления продукта
  showAddProductModal = false;
  isAddingProduct = false;

  // Модальное окно просмотра продукта
  showViewProductModal = false;

  // Модальное окно редактирования продукта
  showEditProductModal = false;
  isEditingProduct = false;

  // Модальное окно добавления категории
  showAddCategoryModal = false;
  isAddingCategory = false;

  searchForm: FormGroup;
  addProductForm: FormGroup;
  editProductForm: FormGroup;
  addCategoryForm: FormGroup;
  private subscriptions = new Subscription();

  constructor(
    private productsService: ProductsService,
    private categoriesService: CategoriesService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.searchForm = this.fb.group({
      search: [''],
      category: ['']
    });

    this.addProductForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      category: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(5)]],
      price: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,3})?$/)]],
      noteGeneral: [''],
      noteSpecial: ['']
    });

    this.addCategoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['', [Validators.required, Validators.minLength(5)]],
      isActive: [true]
    });

    this.editProductForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      category: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(5)]],
      price: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,3})?$/)]],
      noteGeneral: [''],
      noteSpecial: ['']
    });
  }

  ngOnInit(): void {
    this.loadProducts();
    this.loadCategories();
    this.setupSearch();

    // Подписываемся на изменения текущего пользователя
    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        // Обновляем формы в зависимости от роли пользователя
        this.updateFormsForUserRole();
      })
    );
  }

  // Обновляем формы в зависимости от роли пользователя
  private updateFormsForUserRole(): void {
    if (this.currentUser?.role === 'Simple') {
      // Удаляем поле noteSpecial из форм для простых пользователей
      this.addProductForm.removeControl('noteSpecial');
      this.editProductForm.removeControl('noteSpecial');
    } else {
      // Добавляем поле noteSpecial для продвинутых пользователей и администраторов
      if (!this.addProductForm.contains('noteSpecial')) {
        this.addProductForm.addControl('noteSpecial', this.fb.control(''));
      }
      if (!this.editProductForm.contains('noteSpecial')) {
        this.editProductForm.addControl('noteSpecial', this.fb.control(''));
      }
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadProducts(): void {
    this.isLoading = true;
    this.error = null;

    const productsSub = this.productsService.getAllProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.filteredProducts = products;
        this.isLoading = false;
        this.isAddingProduct = false; // Сбрасываем состояние добавления
        this.isEditingProduct = false; // Сбрасываем состояние редактирования
        // Сбрасываем форму поиска, чтобы показать все продукты
        this.searchForm.reset();
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.error = 'Ошибка загрузки продуктов';
        this.isLoading = false;
        this.isAddingProduct = false; // Сбрасываем состояние добавления
        this.isEditingProduct = false; // Сбрасываем состояние редактирования
        // Сбрасываем форму поиска, чтобы показать все продукты
        this.searchForm.reset();
      }
    });

    this.subscriptions.add(productsSub);
  }

  private loadCategories(): void {
    const categoriesSub = this.categoriesService.getAllCategories().subscribe({
      next: (categories) => {
        this.categories = categories.map(cat => cat.name);
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      }
    });

    this.subscriptions.add(categoriesSub);
  }

  private setupSearch(): void {
    const searchSub = this.searchForm.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(values => {
        const { search, category } = values;

        // Используем комбинированный метод поиска и фильтрации
        return this.productsService.searchAndFilterProducts(search || '', category || '');
      }),
      catchError(error => {
        console.error('Search error:', error);
        return of([]);
      })
    ).subscribe({
      next: (products: Product[]) => {
        this.filteredProducts = products;
      }
    });

    this.subscriptions.add(searchSub);
  }

  selectProduct(product: Product): void {
    this.selectedProduct = product;
    this.showViewProductModal = true;
  }

  // Логика добавления продукта
  addProduct(): void {
    this.showAddProductModal = true;
    this.addProductForm.reset();

    // Обновляем форму в зависимости от роли пользователя после сброса
    this.updateFormsForUserRole();
  }

  closeAddProductModal(): void {
    this.showAddProductModal = false;
    this.addProductForm.reset();

    // Обновляем форму в зависимости от роли пользователя после сброса
    this.updateFormsForUserRole();

    this.isAddingProduct = false;
    this.selectedProduct = null;
  }

  onSubmitAddProduct(): void {
    if (this.addProductForm.valid) {
      this.isAddingProduct = true;

      const productData: CreateProductDto = {
        name: this.addProductForm.get('name')?.value,
        category: this.addProductForm.get('category')?.value,
        description: this.addProductForm.get('description')?.value,
        price: this.addProductForm.get('price')?.value,
        noteGeneral: this.addProductForm.get('noteGeneral')?.value || undefined
      };

      // Добавляем noteSpecial только если пользователь не простой
      if (this.currentUser?.role !== 'Simple') {
        productData.noteSpecial = this.addProductForm.get('noteSpecial')?.value || undefined;
      }

      // Фильтруем пустые строки
      if (productData.noteGeneral === '') {
        productData.noteGeneral = undefined;
      }
      if (productData.noteSpecial === '') {
        productData.noteSpecial = undefined;
      }

      // Получаем текущего пользователя для логирования
      this.authService.currentUser$.pipe(take(1)).subscribe((currentUser: User | null) => {
        if (currentUser) {
          this.productsService.createProductWithLogging(productData, currentUser).subscribe({
            next: (newProduct) => {
              // Перезагружаем продукты из Firestore для избежания дублирования
              this.loadProducts();
              this.resetSelectedProduct();
              this.closeAddProductModal();
              // Сбрасываем форму поиска, чтобы показать все продукты
              this.searchForm.reset();
              console.log('Продукт успешно добавлен:', newProduct);
              this.showSuccessMessage('Продукт успешно добавлен!');
            },
            error: (error) => {
              console.error('Error creating product:', error);
              this.error = 'Ошибка при добавлении продукта';
              this.isAddingProduct = false;
            }
          });
        } else {
          // Если пользователь не авторизован, создаем продукт без логирования
          this.productsService.createProduct(productData).subscribe({
            next: (newProduct) => {
              // Перезагружаем продукты из Firestore для избежания дублирования
              this.loadProducts();
              this.resetSelectedProduct();
              this.closeAddProductModal();
              // Сбрасываем форму поиска, чтобы показать все продукты
              this.showSuccessMessage('Продукт успешно добавлен!');
            },
            error: (error) => {
              console.error('Error creating product:', error);
              this.error = 'Ошибка при добавлении продукта';
              this.isAddingProduct = false;
            }
          });
        }
      });
    } else {
      Object.keys(this.addProductForm.controls).forEach(key => {
        const control = this.addProductForm.get(key);
        if (control) {
          control.markAsTouched();
        }
      });
    }
  }

  // Логика добавления категории
  addCategory(): void {
    // Проверяем роль пользователя - простые пользователи не могут создавать категории
    if (this.currentUser?.role === 'Simple') {
      alert('У вас нет прав для создания категорий. Обратитесь к администратору.');
      return;
    }

    this.showAddCategoryModal = true;
    this.addCategoryForm.reset();
    this.addCategoryForm.patchValue({ isActive: true });
  }

  closeAddCategoryModal(): void {
    this.showAddCategoryModal = false;
    this.addCategoryForm.reset();
    this.isAddingCategory = false;
    this.selectedProduct = null;
  }

  onSubmitAddCategory(): void {
    // Проверяем роль пользователя - простые пользователи не могут создавать категории
    if (this.currentUser?.role === 'Simple') {
      alert('У вас нет прав для создания категорий. Обратитесь к администратору.');
      return;
    }

    if (this.addCategoryForm.valid) {
      this.isAddingCategory = true;

      const categoryData: CreateCategoryDto = {
        name: this.addCategoryForm.get('name')?.value,
        description: this.addCategoryForm.get('description')?.value,
        isActive: this.addCategoryForm.get('isActive')?.value
      };

      // Получаем текущего пользователя для логирования
      this.authService.currentUser$.pipe(take(1)).subscribe((currentUser: User | null) => {
        if (currentUser) {
          this.categoriesService.createCategoryWithLogging(categoryData, currentUser).subscribe({
            next: (newCategory) => {
              // Добавляем новую категорию в список
              this.categories.push(newCategory.name);

              // Закрываем модальное окно
              this.closeAddCategoryModal();

              console.log('Категория успешно добавлена:', newCategory);
              this.showSuccessMessage('Категория успешно добавлена!');

              // Обновляем список категорий в форме продукта
              this.addProductForm.patchValue({ category: newCategory.name });
            },
            error: (error) => {
              console.error('Error creating category:', error);
              this.error = 'Ошибка при добавлении категории';
              this.isAddingCategory = false;
            }
          });
        } else {
          // Если пользователь не авторизован, создаем категорию без логирования
          this.categoriesService.createCategory(categoryData).subscribe({
            next: (newCategory) => {
              // Добавляем новую категорию в список
              this.categories.push(newCategory.name);

              // Закрываем модальное окно
              this.closeAddCategoryModal();

              console.log('Категория успешно добавлена:', newCategory);
              this.showSuccessMessage('Категория успешно добавлена!');

              // Обновляем список категорий в форме продукта
              this.addProductForm.patchValue({ category: newCategory.name });
            },
            error: (error) => {
              console.error('Error creating category:', error);
              this.error = 'Ошибка при добавлении категории';
              this.isAddingCategory = false;
            }
          });
        }
      });
    } else {
      Object.keys(this.addCategoryForm.controls).forEach(key => {
        const control = this.addCategoryForm.get(key);
        if (control) {
          control.markAsTouched();
        }
      });
    }
  }

  private showSuccessMessage(message: string): void {
    alert(message);
  }

  deleteProduct(product: Product): void {
    // Проверяем роль пользователя - простые пользователи не могут удалять продукты
    if (this.currentUser?.role === 'Simple') {
      alert('У вас нет прав для удаления продуктов. Обратитесь к администратору.');
      return;
    }

    if (confirm(`Вы уверены, что хотите удалить продукт "${product.name}"?`)) {
      // Получаем текущего пользователя для логирования
      this.authService.currentUser$.pipe(take(1)).subscribe((currentUser: User | null) => {
        if (currentUser) {
          this.productsService.deleteProductWithLogging(product.id, currentUser).subscribe({
            next: () => {
              // Перезагружаем продукты из Firestore для избежания дублирования
              this.loadProducts();
              // Сбрасываем форму поиска, чтобы показать все продукты
              this.searchForm.reset();

              if (this.selectedProduct?.id === product.id) {
                this.selectedProduct = null;
              }

              console.log('Продукт успешно удален');
            },
            error: (error) => {
              console.error('Error deleting product:', error);
              alert('Ошибка при удалении продукта');
            }
          });
        } else {
          // Если пользователь не авторизован, удаляем продукт без логирования
          this.productsService.deleteProduct(product.id).subscribe({
            next: () => {
              // Перезагружаем продукты из Firestore для избежания дублирования
              this.loadProducts();
              // Сбрасываем форму поиска, чтобы показать все продукты
              this.searchForm.reset();

              if (this.selectedProduct?.id === product.id) {
                this.selectedProduct = null;
              }

              console.log('Продукт успешно удален');
            },
            error: (error) => {
              console.error('Error deleting product:', error);
              alert('Ошибка при удалении продукта');
            }
          });
        }
      });
    }
  }

  editProduct(product: Product): void {
    this.selectedProduct = product;
    this.showEditProductModal = true;

    const formData: any = {
      name: product.name,
      category: product.category,
      description: product.description,
      price: product.price,
      noteGeneral: product.noteGeneral || ''
    };

    // Добавляем noteSpecial только если пользователь не простой
    if (this.currentUser?.role !== 'Simple') {
      formData.noteSpecial = product.noteSpecial || '';
    }

    this.editProductForm.patchValue(formData);
    console.log('Редактирование продукта:', product);
  }

  closeEditProductModal(): void {
    this.showEditProductModal = false;
    this.editProductForm.reset();

    // Обновляем форму в зависимости от роли пользователя после сброса
    this.updateFormsForUserRole();

    this.isEditingProduct = false;
    this.selectedProduct = null;
  }

  onSubmitEditProduct(): void {
    if (this.editProductForm.valid && this.selectedProduct) {
      this.isEditingProduct = true;

      const productData: CreateProductDto = {
        name: this.editProductForm.get('name')?.value,
        category: this.editProductForm.get('category')?.value,
        description: this.editProductForm.get('description')?.value,
        price: this.editProductForm.get('price')?.value,
        noteGeneral: this.editProductForm.get('noteGeneral')?.value || undefined
      };

      // Добавляем noteSpecial только если пользователь не простой
      if (this.currentUser?.role !== 'Simple') {
        productData.noteSpecial = this.editProductForm.get('noteSpecial')?.value || undefined;
      }

      // Фильтруем пустые строки
      if (productData.noteGeneral === '') {
        productData.noteGeneral = undefined;
      }
      if (productData.noteSpecial === '') {
        productData.noteSpecial = undefined;
      }

      // Получаем текущего пользователя для логирования
      this.authService.currentUser$.pipe(take(1)).subscribe((currentUser: User | null) => {
        if (currentUser && this.selectedProduct) {
          this.productsService.updateProductWithLogging(this.selectedProduct.id, productData, currentUser).subscribe({
            next: () => {
              // Перезагружаем продукты из Firestore для избежания дублирования
              this.loadProducts();
              this.closeEditProductModal();
              // Сбрасываем форму поиска, чтобы показать все продукты
              this.searchForm.reset();
              console.log('Продукт успешно обновлен');
              this.showSuccessMessage('Продукт успешно обновлен!');
            },
            error: (error) => {
              console.error('Error updating product:', error);
              this.error = 'Ошибка при обновлении продукта';
              this.isEditingProduct = false;
            }
          });
        } else if (this.selectedProduct) {
          // Если пользователь не авторизован, обновляем продукт без логирования
          this.productsService.updateProduct(this.selectedProduct.id, productData).subscribe({
            next: () => {
              // Перезагружаем продукты из Firestore для избежания дублирования
              this.loadProducts();
              this.closeEditProductModal();
              // Сбрасываем форму поиска, чтобы показать все продукты
              this.searchForm.reset();
              console.log('Продукт успешно обновлен');
              this.showSuccessMessage('Продукт успешно обновлен!');
            },
            error: (error) => {
              console.error('Error updating product:', error);
              this.error = 'Ошибка при обновлении продукта';
              this.isEditingProduct = false;
            }
          });
        }
      });
    } else {
      Object.keys(this.editProductForm.controls).forEach(key => {
        const control = this.editProductForm.get(key);
        if (control) {
          control.markAsTouched();
        }
      });
    }
  }

  closeViewProductModal(): void {
    this.showViewProductModal = false;
    this.selectedProduct = null;
  }

  viewProduct(product: Product): void {
    this.selectProduct(product);
  }

  private resetSelectedProduct(): void {
    this.selectedProduct = null;
  }

  // Геттеры для удобного доступа к полям формы
  get nameField() { return this.addProductForm.get('name'); }
  get categoryField() { return this.addProductForm.get('category'); }
  get descriptionField() { return this.addProductForm.get('description'); }
  get priceField() { return this.addProductForm.get('price'); }

  // Геттеры для формы редактирования продукта
  get editNameField() { return this.editProductForm.get('name'); }
  get editCategoryField() { return this.editProductForm.get('category'); }
  get editDescriptionField() { return this.editProductForm.get('description'); }
  get editPriceField() { return this.editProductForm.get('price'); }

  // Геттеры для формы категории
  get categoryNameField() { return this.addCategoryForm.get('name'); }
  get categoryDescriptionField() { return this.addCategoryForm.get('description'); }
}
