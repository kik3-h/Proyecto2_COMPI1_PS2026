import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { Aplicacion } from './app/app';

bootstrapApplication(Aplicacion, appConfig)
  .catch((err) => console.error(err));
