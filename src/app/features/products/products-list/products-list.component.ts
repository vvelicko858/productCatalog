import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription, combineLatest, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, map } from 'rxjs/operators';
import { ProductsService } from '../../../core/services/products.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { Product, CreateProductDto } from '../../../core/models/product';
import { Category, CreateCategoryDto } from '../../../core/models/category';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
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
  
  // Модальное окно добавления продукта
  showAddProductModal = false;
  isAddingProduct = false;
  
  // Модальное окно добавления категории
  showAddCategoryModal = false;
  isAddingCategory = false;
  
  searchForm: FormGroup;
  addProductForm: FormGroup;
  addCategoryForm: FormGroup;
  private subscriptions = new Subscription();

  constructor(
    private productsService: ProductsService,
    private categoriesService: CategoriesService,
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
  }

  ngOnInit(): void {
    this.loadProducts();
    this.loadCategories();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.subscriptions.add(this.subscriptions);
  }

  loadProducts(): void {
    this.isLoading = true;
    this.error = null;

    const productsSub = this.productsService.getAllProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.filteredProducts = products;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.error = 'Ошибка загрузки продуктов';
        this.isLoading = false;
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
        return this.productsService.searchAndFilterProducts(search, category);
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
  }

  onSearch(): void {
    console.log('Поиск выполнен');
  }

  onFilter(): void {
    console.log('Фильтр применен');
  }

  // Логика добавления продукта
  addProduct(): void {
    this.showAddProductModal = true;
    this.addProductForm.reset();
  }

  closeAddProductModal(): void {
    this.showAddProductModal = false;
    this.addProductForm.reset();
    this.isAddingProduct = false;
  }

  onSubmitAddProduct(): void {
    if (this.addProductForm.valid) {
      this.isAddingProduct = true;
      
      const productData: CreateProductDto = {
        name: this.addProductForm.get('name')?.value,
        category: this.addProductForm.get('category')?.value,
        description: this.addProductForm.get('description')?.value,
        price: this.addProductForm.get('price')?.value,
        noteGeneral: this.addProductForm.get('noteGeneral')?.value || undefined,
        noteSpecial: this.addProductForm.get('noteSpecial')?.value || undefined
      };

      // Фильтруем пустые строки
      if (productData.noteGeneral === '') {
        productData.noteGeneral = undefined;
      }
      if (productData.noteSpecial === '') {
        productData.noteSpecial = undefined;
      }

      this.productsService.createProduct(productData).subscribe({
        next: (newProduct) => {
          this.products.unshift(newProduct);
          this.filteredProducts.unshift(newProduct);
          this.closeAddProductModal();
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
    this.showAddCategoryModal = true;
    this.addCategoryForm.reset();
    this.addCategoryForm.patchValue({ isActive: true });
  }

  closeAddCategoryModal(): void {
    this.showAddCategoryModal = false;
    this.addCategoryForm.reset();
    this.isAddingCategory = false;
  }

  onSubmitAddCategory(): void {
    if (this.addCategoryForm.valid) {
      this.isAddingCategory = true;
      
      const categoryData: CreateCategoryDto = {
        name: this.addCategoryForm.get('name')?.value,
        description: this.addCategoryForm.get('description')?.value,
        isActive: this.addCategoryForm.get('isActive')?.value
      };

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
    if (confirm(`Вы уверены, что хотите удалить продукт "${product.name}"?`)) {
      this.productsService.deleteProduct(product.id).subscribe({
        next: () => {
          this.products = this.products.filter(p => p.id !== product.id);
          this.filteredProducts = this.filteredProducts.filter(p => p.id !== product.id);
          
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
  }

  editProduct(product: Product): void {
    this.selectProduct(product);
    console.log('Редактирование продукта:', product);
  }

  // Геттеры для удобного доступа к полям формы
  get nameField() { return this.addProductForm.get('name'); }
  get categoryField() { return this.addProductForm.get('category'); }
  get descriptionField() { return this.addProductForm.get('description'); }
  get priceField() { return this.addProductForm.get('price'); }
  
  // Геттеры для формы категории
  get categoryNameField() { return this.addCategoryForm.get('name'); }
  get categoryDescriptionField() { return this.addCategoryForm.get('description'); }
}
