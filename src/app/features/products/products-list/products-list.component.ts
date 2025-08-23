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

  showAddProductModal = false;
  isAddingProduct = false;

  showViewProductModal = false;

  showEditProductModal = false;
  isEditingProduct = false;

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

    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        this.updateFormsForUserRole();
      })
    );
  }

  private updateFormsForUserRole(): void {
    if (this.currentUser?.role === 'Simple') {
      this.addProductForm.removeControl('noteSpecial');
      this.editProductForm.removeControl('noteSpecial');
    } else {
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
        this.isAddingProduct = false;
        this.isEditingProduct = false;
        this.searchForm.reset();
      },
      error: (error) => {
        this.error = 'Ошибка загрузки продуктов';
        this.isLoading = false;
        this.isAddingProduct = false;
        this.isEditingProduct = false;
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
        return this.productsService.searchAndFilterProducts(search || '', category || '');
      }),
      catchError(error => {
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

  addProduct(): void {
    this.showAddProductModal = true;
    this.addProductForm.reset();
    this.updateFormsForUserRole();
  }

  closeAddProductModal(): void {
    this.showAddProductModal = false;
    this.addProductForm.reset();
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

      if (this.currentUser?.role !== 'Simple') {
        productData.noteSpecial = this.addProductForm.get('noteSpecial')?.value || undefined;
      }

      if (productData.noteGeneral === '') {
        productData.noteGeneral = undefined;
      }
      if (productData.noteSpecial === '') {
        productData.noteSpecial = undefined;
      }

      this.authService.currentUser$.pipe(take(1)).subscribe((currentUser: User | null) => {
        if (currentUser) {
          this.productsService.createProductWithLogging(productData, currentUser).subscribe({
            next: (newProduct) => {
              this.loadProducts();
              this.resetSelectedProduct();
              this.closeAddProductModal();
              this.searchForm.reset();
              this.showSuccessMessage('Продукт успешно добавлен!');
            },
            error: (error) => {
              this.error = 'Ошибка при добавлении продукта';
              this.isAddingProduct = false;
            }
          });
        } else {
          this.productsService.createProduct(productData).subscribe({
            next: (newProduct) => {
              this.loadProducts();
              this.resetSelectedProduct();
              this.closeAddProductModal();
              this.showSuccessMessage('Продукт успешно добавлен!');
            },
            error: (error) => {
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

  addCategory(): void {
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

      this.authService.currentUser$.pipe(take(1)).subscribe((currentUser: User | null) => {
        if (currentUser) {
          this.categoriesService.createCategoryWithLogging(categoryData, currentUser).subscribe({
            next: (newCategory) => {
              this.categories.push(newCategory.name);
              this.closeAddCategoryModal();
              this.showSuccessMessage('Категория успешно добавлена!');
              this.addProductForm.patchValue({ category: newCategory.name });
            },
            error: (error) => {
              this.error = 'Ошибка при добавлении категории';
              this.isAddingCategory = false;
            }
          });
        } else {
          this.categoriesService.createCategory(categoryData).subscribe({
            next: (newCategory) => {
              this.categories.push(newCategory.name);
              this.closeAddCategoryModal();
              this.showSuccessMessage('Категория успешно добавлена!');
              this.addProductForm.patchValue({ category: newCategory.name });
            },
            error: (error) => {
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
    if (this.currentUser?.role === 'Simple') {
      alert('У вас нет прав для удаления продуктов. Обратитесь к администратору.');
      return;
    }

    if (confirm(`Вы уверены, что хотите удалить продукт "${product.name}"?`)) {
      this.authService.currentUser$.pipe(take(1)).subscribe((currentUser: User | null) => {
        if (currentUser) {
          this.productsService.deleteProductWithLogging(product.id, currentUser).subscribe({
            next: () => {
              this.loadProducts();
              this.searchForm.reset();
              if (this.selectedProduct?.id === product.id) {
                this.selectedProduct = null;
              }
            },
            error: (error) => {
              alert('Ошибка при удалении продукта');
            }
          });
        } else {
          this.productsService.deleteProduct(product.id).subscribe({
            next: () => {
              this.loadProducts();
              this.searchForm.reset();

              if (this.selectedProduct?.id === product.id) {
                this.selectedProduct = null;
              }
              },
            error: (error) => {
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

    if (this.currentUser?.role !== 'Simple') {
      formData.noteSpecial = product.noteSpecial || '';
    }

    this.editProductForm.patchValue(formData);
  }

  closeEditProductModal(): void {
    this.showEditProductModal = false;
    this.editProductForm.reset();
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

      if (this.currentUser?.role !== 'Simple') {
        productData.noteSpecial = this.editProductForm.get('noteSpecial')?.value || undefined;
      }

      if (productData.noteGeneral === '') {
        productData.noteGeneral = undefined;
      }
      if (productData.noteSpecial === '') {
        productData.noteSpecial = undefined;
      }

      this.authService.currentUser$.pipe(take(1)).subscribe((currentUser: User | null) => {
        if (currentUser && this.selectedProduct) {
          this.productsService.updateProductWithLogging(this.selectedProduct.id, productData, currentUser).subscribe({
            next: () => {
              this.loadProducts();
              this.closeEditProductModal();
              this.searchForm.reset();
              this.showSuccessMessage('Продукт успешно обновлен!');
            },
            error: (error) => {
              this.error = 'Ошибка при обновлении продукта';
              this.isEditingProduct = false;
            }
          });
        } else if (this.selectedProduct) {
          this.productsService.updateProduct(this.selectedProduct.id, productData).subscribe({
            next: () => {
              this.loadProducts();
              this.closeEditProductModal();
              this.searchForm.reset();
              this.showSuccessMessage('Продукт успешно обновлен!');
            },
            error: (error) => {
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

  get nameField() { return this.addProductForm.get('name'); }
  get categoryField() { return this.addProductForm.get('category'); }
  get descriptionField() { return this.addProductForm.get('description'); }
  get priceField() { return this.addProductForm.get('price'); }

  get editNameField() { return this.editProductForm.get('name'); }
  get editCategoryField() { return this.editProductForm.get('category'); }
  get editDescriptionField() { return this.editProductForm.get('description'); }
  get editPriceField() { return this.editProductForm.get('price'); }

  get categoryNameField() { return this.addCategoryForm.get('name'); }
  get categoryDescriptionField() { return this.addCategoryForm.get('description'); }
}
