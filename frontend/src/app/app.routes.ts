import { Routes } from '@angular/router';
import { StreaksComponent } from './streaks/streaks.component';

export const routes: Routes = [
    { path: '', redirectTo: '/streaks', pathMatch: 'full' },
    { path: 'streaks', component: StreaksComponent }
];
