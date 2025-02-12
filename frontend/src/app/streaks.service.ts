import { computed, Injectable, signal } from '@angular/core';
import { StreakDay } from './streak-day/streak-day.component';

@Injectable({ providedIn: 'root' })
export class StreaksService {
    private earliestSupportedYear = 2020;
    private localStorageKey = 'ewancoder_streaks_data';
    private data: HabitStreakData[];
    public streaksSignal = signal<HabitStreak[]>([]);

    constructor() {
        const data = localStorage.getItem(this.localStorageKey) ?? '[]';
        this.data = JSON.parse(data) as HabitStreakData[];
        this.recalculateStreaks();
    }

    public setDays(habit: string, days: number) {
        const found = this.data.find(s => s.habit === habit);
        found!.lengthDays = days;

        this.saveData();
        this.recalculateStreaks();
    }

    public updateHabit(habit: string, update: UpdateHabit) {
        const found = this.data.find(s => s.habit === habit);
        found!.habit = update.habit;
        found!.lengthDays = update.lengthDays;

        this.saveData();
        this.recalculateStreaks();
    }

    public toggle(day: StreakDay) {
        const streak = this.data.find(s => s.habit === day.habit);
        const found = streak!.days.find(d => d === day.id);
        if (found) {
            streak!.days.splice(streak!.days.indexOf(found), 1);
        } else {
            streak!.days.push(day.id);
        }

        this.saveData();
        this.recalculateStreaks();
    }

    public createHabit(habit: string, length: number) {
        const streak: HabitStreakData = {
            habit: habit,
            days: [],
            lengthDays: length
        };

        this.data.push(streak);

        this.saveData();
        this.recalculateStreaks();
    }

    public getMonthDaysSignal(year: number, month: number) {
        const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth();
        const startingDayNumber = this.getStartingDayNumber(year, month);
        const daysAmount = this.getDaysInMonth(year, month);
        const monthDaysSignal = computed(() => {
            const data = this.streaksSignal();

            const days: Record<string, StreakDay[]> = {};
            for (let i = 0; i < daysAmount; i++) {
                for (const habitData of data) {
                    if (!days[habitData.habit]) days[habitData.habit] = [];

                    const dayStatus = habitData.days[i + startingDayNumber] ?? DayStatus.Empty;
                    const day: StreakDay = {
                        id: i + startingDayNumber,
                        day: i + 1,
                        habit: habitData.habit,
                        status: dayStatus
                    };

                    if (isCurrentMonth && i + 1 === new Date().getDate()) {
                        day.isToday = true;
                    }

                    days[habitData.habit].push(day);
                }
            }

            return days;
        });

        return monthDaysSignal;
    }

    private getStartingDayNumber(year: number, month: number): number {
        const additionalDaysFromYear =
            year === this.earliestSupportedYear
                ? 0
                : Array.from(Array(year - this.earliestSupportedYear).keys())
                      .map(x => x + this.earliestSupportedYear)
                      .map(year => this.getDaysInYear(year))
                      .reduce((partialSum, a) => partialSum + a, 0);

        const additionalDaysFromMonth =
            month === 0
                ? 0
                : Array.from(Array(month).keys())
                      .map(month => this.getDaysInMonth(year, month))
                      .reduce((partialSum, a) => partialSum + a, 0);

        return additionalDaysFromYear + additionalDaysFromMonth + 1;
    }

    private getDaysInYear(year: number): number {
        return (year % 4 === 0 && year % 100 > 0) || year % 400 == 0 ? 366 : 365;
    }

    private getDaysInMonth(year: number, month: number): number {
        return new Date(year, month + 1, 0).getDate();
    }

    private recalculateStreaks() {
        const streaks = this.data.map(streak => ({
            habit: streak.habit,
            days: this.calculateDays(streak.days, streak.lengthDays)
        }));

        this.streaksSignal.set(streaks);
    }

    private calculateDays(days: number[], lengthDays: number) {
        const sortedDays = days.sort((a, b) => a - b);
        const resultDays: Record<number, DayStatus> = {};

        for (const day of sortedDays) {
            resultDays[day] = DayStatus.Successful;

            for (let additionalDay = 1; additionalDay < lengthDays; additionalDay++) {
                resultDays[day + additionalDay] = DayStatus.Inherited;
            }
        }

        return resultDays;
    }

    private saveData() {
        localStorage.setItem(this.localStorageKey, JSON.stringify(this.data));
    }
}

export interface HabitStreak {
    habit: string;
    days: Record<number, DayStatus>;
}

export enum DayStatus {
    Empty = 0,
    Successful = 1,
    Inherited = 2
}

interface HabitStreakData {
    habit: string;
    days: number[];
    lengthDays: number;
}

interface UpdateHabit {
    habit: string;
    lengthDays: number;
}
