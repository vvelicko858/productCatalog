import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from '@angular/fire/firestore';
import { Observable, from, map, catchError, of } from 'rxjs';
import { Category, CreateCategoryDto, UpdateCategoryDto } from '../models/category';

@Injectable({
  providedIn: 'root'
})
export class CategoriesService {
  private readonly collectionName = 'categories';

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

  // Проверить, используется ли категория в продуктах
  isCategoryUsed(categoryName: string): Observable<boolean> {
    // Здесь добавить логику проверки использования категории
    // Пока возвращаем false
    return of(false);
  }
}
