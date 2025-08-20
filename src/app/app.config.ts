import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';
import { environment } from '../environments/environment';
import {getFirestore, provideFirestore, connectFirestoreEmulator} from '@angular/fire/firestore';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes),
    provideFirebaseApp(() => {
      const app = initializeApp(environment.firebase);
      console.log('Firebase app initialized:', app.name);
      return app;
    }),
    provideAuth(() => {
      const auth = getAuth();
      console.log('Firebase Auth initialized');
      
      // В режиме разработки можно подключить эмулятор
      if (!environment.production && environment.useEmulators) {
        try {
          connectAuthEmulator(auth, 'http://localhost:9099');
          console.log('Firebase Auth emulator connected');
        } catch (error) {
          console.log('Firebase Auth emulator already connected or not available');
        }
      }
      
      return auth;
    }),
    provideFirestore(() => {
      const firestore = getFirestore();
      console.log('Firebase Firestore initialized');
      
      // В режиме разработки можно подключить эмулятор
      if (!environment.production && environment.useEmulators) {
        try {
          connectFirestoreEmulator(firestore, 'localhost', 8080);
          console.log('Firebase Firestore emulator connected');
        } catch (error) {
          console.log('Firebase Firestore emulator already connected or not available');
        }
      }
      
      return firestore;
    })
  ]
};
