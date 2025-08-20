import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from '@angular/fire/firestore';
import { Observable, from, map, catchError, of, switchMap } from 'rxjs';
import { Product, CreateProductDto, UpdateProductDto } from '../models/product';
import { LogsService } from './logs.service';
import { User } from '../models/user';

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private readonly collectionName = 'products';

  constructor(
    private firestore: Firestore,
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

  // Получить все продукты
  getAllProducts(): Observable<Product[]> {
    const productsRef = collection(this.firestore, this.collectionName);
    const q = query(productsRef, orderBy('createdAt', 'desc'));

    return from(getDocs(q)).pipe(
      map(snapshot =>
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Product))
      ),
      catchError(error => {
        console.error('Error fetching products:', error);
        return of([]);
      })
    );
  }

  // Получить продукт по ID
  getProductById(id: string): Observable<Product | null> {
    const productRef = doc(this.firestore, this.collectionName, id);

    return from(getDoc(productRef)).pipe(
      map(doc => {
        if (doc.exists()) {
          return { id: doc.id, ...doc.data() } as Product;
        }
        return null;
      }),
      catchError(error => {
        console.error('Error fetching product:', error);
        return of(null);
      })
    );
  }

  // Создать новый продукт
  createProduct(productData: CreateProductDto): Observable<Product> {
    const productsRef = collection(this.firestore, this.collectionName);

    // Создаем объект с правильной типизацией
    const newProduct: any = {
      name: productData.name,
      category: productData.category,
      description: productData.description,
      price: productData.price,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Добавляем опциональные поля только если они не undefined
    if (productData.noteGeneral !== undefined && productData.noteGeneral !== '') {
      newProduct.noteGeneral = productData.noteGeneral;
    }

    if (productData.noteSpecial !== undefined && productData.noteSpecial !== '') {
      newProduct.noteSpecial = productData.noteSpecial;
    }

    return from(addDoc(productsRef, newProduct)).pipe(
      map(docRef => ({
        id: docRef.id,
        ...newProduct
      } as Product)),
      catchError(error => {
        console.error('Error creating product:', error);
        throw error;
      })
    );
  }

  // Создать новый продукт с логированием
  createProductWithLogging(productData: CreateProductDto, user: User): Observable<Product> {
    return this.createProduct(productData).pipe(
      switchMap(product => {
        // Логируем создание продукта
        this.logsService.logUserAction(
          user,
          'Создание продукта',
          `Создан продукт "${product.name}" в категории "${product.category}"`
        ).pipe(
          catchError(logError => {
            console.warn('Ошибка логирования создания продукта:', logError);
            return of(null);
          })
        ).subscribe(); // Не блокируем основной поток
        return of(product);
      })
    );
  }

  // Обновить продукт
  updateProduct(id: string, productData: UpdateProductDto): Observable<void> {
    const productRef = doc(this.firestore, this.collectionName, id);

    // Очищаем объект от undefined значений
    const cleanData = this.cleanObject({
      ...productData,
      updatedAt: new Date()
    });

    return from(updateDoc(productRef, cleanData)).pipe(
      catchError(error => {
        console.error('Error updating product:', error);
        throw error;
      })
    );
  }

  // Обновить продукт с логированием
  updateProductWithLogging(id: string, productData: UpdateProductDto, user: User): Observable<void> {
    return this.updateProduct(id, productData).pipe(
      switchMap(() => {
        // Логируем обновление продукта
        this.logsService.logUserAction(
          user,
          'Обновление продукта',
          `Обновлен продукт с ID: ${id}`
        ).pipe(
          catchError(logError => {
            console.warn('Ошибка логирования обновления продукта:', logError);
            return of(null);
          })
        ).subscribe(); // Не блокируем основной поток
        return of(void 0);
      })
    );
  }

  // Удалить продукт
  deleteProduct(id: string): Observable<void> {
    const productRef = doc(this.firestore, this.collectionName, id);

    return from(deleteDoc(productRef)).pipe(
      catchError(error => {
        console.error('Error deleting product:', error);
        throw error;
      })
    );
  }

  // Удалить продукт с логированием
  deleteProductWithLogging(id: string, user: User): Observable<void> {
    return this.deleteProduct(id).pipe(
      switchMap(() => {
        // Логируем удаление продукта
        this.logsService.logUserAction(
          user,
          'Удаление продукта',
          `Удален продукт с ID: ${id}`
        ).pipe(
          catchError(logError => {
            console.warn('Ошибка логирования удаления продукта:', logError);
            return of(null);
          })
        ).subscribe(); // Не блокируем основной поток
        return of(void 0);
      })
    );
  }

  // Удалить все продукты по категории
  deleteProductsByCategory(categoryName: string): Observable<void> {
    const productsRef = collection(this.firestore, this.collectionName);
    const q = query(productsRef, where('category', '==', categoryName));

    return from(getDocs(q)).pipe(
      switchMap(snapshot => {
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        return Promise.all(deletePromises);
      }),
      map(() => void 0), // Преобразуем в Observable<void>
      catchError(error => {
        console.error('Error deleting products by category:', error);
        throw error;
      })
    );
  }

  // Комбинированный поиск и фильтрация (клиентская)
  searchAndFilterProducts(searchTerm: string, category: string): Observable<Product[]> {
    return this.getAllProducts().pipe(
      map(products => {
        let filtered = products;

        // Фильтрация по категории
        if (category) {
          filtered = filtered.filter(product => product.category === category);
        }

        // Поиск по названию
        if (searchTerm.trim()) {
          filtered = filtered.filter(product =>
            product.name.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        return filtered;
      })
    );
  }
}
