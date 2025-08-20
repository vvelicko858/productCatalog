import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy, where, limit } from '@angular/fire/firestore';
import { Observable, from, map, catchError, of, switchMap } from 'rxjs';
import { Category, CreateCategoryDto, UpdateCategoryDto } from '../models/category';
import { ProductsService } from './products.service';
import { LogsService } from './logs.service';
import { User } from '../models/user';

@Injectable({
  providedIn: 'root'
})
export class CategoriesService {
  private readonly collectionName = 'categories';

  constructor(
    private firestore: Firestore,
    private productsService: ProductsService,
    private logsService: LogsService
  ) {}

  // Вспомогательный метод для очистки объекта от undefined значений
  private cleanObject(obj: any): any {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined && obj[key] !== null) {
        cleaned[key] = obj[key];
      }
    });
    return cleaned;
  }

  // Получить все категории
  getAllCategories(): Observable<Category[]> {
    const categoriesRef = collection(this.firestore, this.collectionName);
    const q = query(categoriesRef, orderBy('name'));

    return from(getDocs(q)).pipe(
      map(snapshot =>
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Category))
      ),
      catchError(error => {
        console.error('Error fetching categories:', error);
        return of([]);
      })
    );
  }

  // Получить категорию по ID
  getCategoryById(id: string): Observable<Category | null> {
    const categoryRef = doc(this.firestore, this.collectionName, id);

    return from(getDoc(categoryRef)).pipe(
      map(doc => {
        if (doc.exists()) {
          return { id: doc.id, ...doc.data() } as Category;
        }
        return null;
      }),
      catchError(error => {
        console.error('Error fetching category:', error);
        return of(null);
      })
    );
  }

  // Создать новую категорию
  createCategory(categoryData: CreateCategoryDto): Observable<Category> {
    const categoriesRef = collection(this.firestore, this.collectionName);

    const newCategory = {
      name: categoryData.name,
      description: categoryData.description,
      isActive: categoryData.isActive !== undefined ? categoryData.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return from(addDoc(categoriesRef, newCategory)).pipe(
      map(docRef => ({
        id: docRef.id,
        ...newCategory
      } as Category)),
      catchError(error => {
        throw error;
      })
    );
  }

  // Создать новую категорию с логированием
  createCategoryWithLogging(categoryData: CreateCategoryDto, user: User): Observable<Category> {
    return this.createCategory(categoryData).pipe(
      switchMap(category => {
        // Логируем создание категории
        this.logsService.logUserAction(
          user, 
          'Создание категории', 
          `Создана категория "${category.name}" с описанием: "${category.description}"`
        ).pipe(
          catchError(logError => {
            console.warn('Ошибка логирования создания категории:', logError);
            return of(null);
          })
        ).subscribe(); // Не блокируем основной поток
        return of(category);
      })
    );
  }

  // Обновить категорию
  updateCategory(id: string, categoryData: UpdateCategoryDto): Observable<void> {
    const categoryRef = doc(this.firestore, this.collectionName, id);

    // Очищаем объект от undefined значений
    const cleanData = this.cleanObject({
      ...categoryData,
      updatedAt: new Date()
    });

    return from(updateDoc(categoryRef, cleanData)).pipe(
      catchError(error => {
        console.error('Error updating category:', error);
        throw error;
      })
    );
  }

  // Обновить категорию с логированием
  updateCategoryWithLogging(id: string, categoryData: UpdateCategoryDto, user: User): Observable<void> {
    return this.updateCategory(id, categoryData).pipe(
      switchMap(() => {
        // Формируем детальное описание изменений
        const changes = [];
        if (categoryData.name !== undefined) changes.push(`название: "${categoryData.name}"`);
        if (categoryData.description !== undefined) changes.push(`описание: "${categoryData.description}"`);
        if (categoryData.isActive !== undefined) changes.push(`активность: ${categoryData.isActive ? 'активна' : 'неактивна'}`);
        
        const changeDescription = changes.length > 0 ? `Изменены поля: ${changes.join(', ')}` : 'Обновлена категория';
        
        // Логируем обновление категории
        this.logsService.logUserAction(
          user, 
          'Обновление категории', 
          `${changeDescription} (ID: ${id})`
        ).pipe(
          catchError(logError => {
            console.warn('Ошибка логирования обновления категории:', logError);
            return of(null);
          })
        ).subscribe(); // Не блокируем основной поток
        return of(void 0);
      })
    );
  }

  // Удалить категорию
  deleteCategory(id: string): Observable<void> {
    const categoryRef = doc(this.firestore, this.collectionName, id);

    return from(deleteDoc(categoryRef)).pipe(
      catchError(error => {
        console.error('Error deleting category:', error);
        throw error;
      })
    );
  }

  // Удалить категорию и все связанные продукты
  deleteCategoryWithProducts(id: string, categoryName: string): Observable<void> {
    // Сначала удаляем все продукты этой категории
    return this.productsService.deleteProductsByCategory(categoryName).pipe(
      switchMap(() => {
        // Затем удаляем саму категорию
        const categoryRef = doc(this.firestore, this.collectionName, id);
        return from(deleteDoc(categoryRef));
      }),
      catchError(error => {
        console.error('Error deleting category with products:', error);
        throw error;
      })
    );
  }

  // Удалить категорию и все связанные продукты с логированием
  deleteCategoryWithProductsWithLogging(id: string, categoryName: string, user: User): Observable<void> {
    return this.deleteCategoryWithProducts(id, categoryName).pipe(
      switchMap(() => {
        // Логируем удаление категории
        this.logsService.logUserAction(
          user, 
          'Удаление категории', 
          `Удалена категория "${categoryName}" (ID: ${id}) и все связанные продукты`
        ).pipe(
          catchError(logError => {
            console.warn('Ошибка логирования удаления категории:', logError);
            return of(null);
          })
        ).subscribe(); // Не блокируем основной поток
        return of(void 0);
      })
    );
  }

  // Проверить, используется ли категория в продуктах
  isCategoryUsed(categoryName: string): Observable<boolean> {
    const productsRef = collection(this.firestore, 'products');
    const q = query(productsRef, where('category', '==', categoryName), limit(1));
    
    return from(getDocs(q)).pipe(
      map(snapshot => !snapshot.empty),
      catchError(error => {
        console.error('Error checking if category is used:', error);
        return of(false);
      })
    );
  }
}
