import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    constructor() {
        const isDarkTheme = localStorage.getItem('tyr_theme') === 'dark';
    }

    toggleTheme() {
        const currentTheme = localStorage.getItem('tyr_theme');
        if (currentTheme === 'dark') this.setWhiteTheme();
        else this.setDarkTheme();
    }

    setDarkTheme() {
        localStorage.setItem('tyr_theme', 'dark');
        document.documentElement.classList.add('dark-theme');
        document.documentElement.classList.remove('light-theme');
    }

    setWhiteTheme() {
        localStorage.setItem('tyr_theme', 'white');
        document.documentElement.classList.add('light-theme');
        document.documentElement.classList.remove('dark-theme');
    }
}
