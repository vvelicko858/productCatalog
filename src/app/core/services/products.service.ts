import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from '@angular/fire/firestore';
import { Observable, from, map, catchError, of } from 'rxjs';
import { Product, CreateProductDto, UpdateProductDto } from '../models/product';

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private readonly collectionName = 'products';

  constructor(private firestore: Firestore) {}

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

  // Поиск продуктов по названию (клиентская фильтрация)
  searchProductsByName(searchTerm: string): Observable<Product[]> {
    if (!searchTerm.trim()) {
      return this.getAllProducts();
    }

    // Используем клиентскую фильтрацию вместо сложных запросов к Firebase
    return this.getAllProducts().pipe(
      map(products =>
        products.filter(product =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    );
  }

  // Фильтр по категории (клиентская фильтрация)
  getProductsByCategory(category: string): Observable<Product[]> {
    if (!category) {
      return this.getAllProducts();
    }

    // Используем клиентскую фильтрацию вместо запросов к Firebase
    return this.getAllProducts().pipe(
      map(products =>
        products.filter(product => product.category === category)
      )
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
