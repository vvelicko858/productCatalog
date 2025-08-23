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
      return app;
    }),
    provideAuth(() => {
      const auth = getAuth();

      if (!environment.production && environment.useEmulators) {
        try {
          connectAuthEmulator(auth, 'http://localhost:9099');
        } catch (error) {
        }
      }

      return auth;
    }),
    provideFirestore(() => {
      const firestore = getFirestore();

      if (!environment.production && environment.useEmulators) {
        try {
          connectFirestoreEmulator(firestore, 'localhost', 8080);
        } catch (error) {
        }
      }

      return firestore;
    })
  ]
};
