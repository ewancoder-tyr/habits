import { Component, computed, signal, WritableSignal } from '@angular/core';
import { StreaksService } from '../streaks.service';
import { HabitsMonthGridComponent } from '../habits-month-grid/habits-month-grid.component';
import { ThemeService } from '../theme.service';

export interface SelectedMonth {
    year: number;
    month: number;
}

@Component({
    selector: 'hab-streaks',
    imports: [HabitsMonthGridComponent],
    templateUrl: './streaks.component.html',
    styleUrl: './streaks.component.scss'
})
export class StreaksComponent {
    protected monthSignal: WritableSignal<SelectedMonth> = signal({
        year: new Date().getFullYear(),
        month: new Date().getMonth()
    });
    protected previousMonthSignal = computed(() => this.getPreviousMonth());
    protected nextMonthSignal = computed(() => this.getNextMonth());

    constructor(
        private streaksService: StreaksService,
        protected themeService: ThemeService
    ) {}

    protected createHabit() {
        const habit = prompt('Habit name');
        const lengthDays = prompt('Length of streak (for example 2 means you need to do it every other day)');

        if (habit && lengthDays) {
            this.streaksService.createHabit(habit, +lengthDays);
        }
    }

    protected moveBack() {
        this.monthSignal.set(this.getPreviousMonth());
    }

    protected moveForward() {
        this.monthSignal.set(this.getNextMonth());
    }

    private getPreviousMonth() {
        const current = this.monthSignal();
        const previousYear = current.month === 0 ? current.year - 1 : current.year;
        const previousMonth = current.month === 0 ? 11 : current.month - 1;

        return {
            year: previousYear,
            month: previousMonth
        };
    }

    private getNextMonth() {
        const current = this.monthSignal();
        const nextYear = current.month === 11 ? current.year + 1 : current.year;
        const nextMonth = current.month === 11 ? 0 : current.month + 1;

        return {
            year: nextYear,
            month: nextMonth
        };
    }
}
