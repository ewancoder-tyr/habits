import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    public isDarkThemeSignal = signal(false);

    constructor() {
        const isDarkTheme = localStorage.getItem('tyr_theme') === 'dark';
        this.isDarkThemeSignal.set(isDarkTheme);
    }

    toggleTheme() {
        const currentTheme = localStorage.getItem('tyr_theme');
        if (currentTheme === 'dark') this.setWhiteTheme();
        else this.setDarkTheme();
    }

    setDarkTheme() {
        localStorage.setItem('tyr_theme', 'dark');
        document.documentElement.classList.add('dark-theme');
        this.isDarkThemeSignal.set(true);
    }

    setWhiteTheme() {
        localStorage.setItem('tyr_theme', 'white');
        document.documentElement.classList.remove('dark-theme');
        this.isDarkThemeSignal.set(false);
    }
}
