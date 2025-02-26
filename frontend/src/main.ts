import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

const theme = localStorage.getItem('tyr_theme');
if (theme === 'dark') {
    document.documentElement.classList.add('dark-theme');
    document.documentElement.classList.remove('light-theme');
}

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
