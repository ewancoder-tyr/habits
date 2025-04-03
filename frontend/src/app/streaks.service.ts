import { computed, Injectable, Signal } from '@angular/core';
import { StreakDay } from './streak-day/streak-day.component';
import { UiHabitService } from './state-management/ui-habit.service';

@Injectable({ providedIn: 'root' })
export class StreaksService {
    private earliestSupportedYear = 2020;

    constructor(private uiHabitService: UiHabitService) {}

    public getMonthDaysSignal(year: number, month: number, group?: string) {
        const isCurrentMonth = this.isCurrentMonth(year, month);

        // Days are counted from 2020 1st of January 1..2..3..etc, e.g. 2021 1st of January will be 366.
        const startingDayId = this.getFirstDayOfMonth(year, month);
        const daysAmount = this.getDaysInMonth(year, month);
        const monthDaysSignal = computed(() => {
            const groups = this.uiHabitService.groupedHabitsSignal();
            const habits = groups.find(g => g.group === group)?.habits ?? [];

            // StreakDay is a model for the component that shows the days.
            const habitDays: Record<string, StreakDay[]> = {};
            for (let i = 0; i < daysAmount; i++) {
                for (const habit of habits) {
                    if (!habitDays[habit.name]) habitDays[habit.name] = [];

                    const dayInfo = habit.streakDays[i + startingDayId] ?? {
                        status: DayStatus.Empty,
                        timesDone: 0,
                        timesNeeded: 0
                    };

                    const day: StreakDay = {
                        id: i + startingDayId,
                        day: i + 1,
                        habit: habit.name,
                        info: dayInfo
                    };

                    if (isCurrentMonth && i + 1 === new Date().getDate()) {
                        day.isToday = true;
                    }

                    habitDays[habit.name].push(day);
                }
            }

            return habitDays;
        });

        return monthDaysSignal;
    }

    private getFirstDayOfMonth(year: number, month: number): number {
        if (year < this.earliestSupportedYear) throw new Error('Unsupported year.');

        const additionalDaysFromYear =
            year === this.earliestSupportedYear ? 0 : this.getAmountOfDaysTillYear(year);

        const additionalDaysFromMonth =
            month === 0 ? 0 : this.getAmountOfDaysTillMonth(year, month);

        return additionalDaysFromYear + additionalDaysFromMonth + 1;
    }

    private getAmountOfDaysTillYear(year: number) {
        return Array.from(Array(year - this.earliestSupportedYear).keys())
            .map(x => x + this.earliestSupportedYear)
            .map(year => this.getDaysInYear(year))
            .reduce((partialSum, a) => partialSum + a, 0);
    }

    private getAmountOfDaysTillMonth(year: number, month: number) {
        return Array.from(Array(month).keys())
            .map(month => this.getDaysInMonth(year, month))
            .reduce((partialSum, a) => partialSum + a, 0);
    }

    private getDaysInYear(year: number): number {
        return (year % 4 === 0 && year % 100 > 0) || year % 400 == 0 ? 366 : 365;
    }

    private getDaysInMonth(year: number, month: number): number {
        return new Date(year, month + 1, 0).getDate();
    }

    private isCurrentMonth(year: number, month: number) {
        const now = new Date();
        return year === now.getFullYear() && month === now.getMonth();
    }
}

export interface DayInfo {
    status: DayStatus;
    timesDone: number;
    timesNeeded: number;
}

export interface HabitStreak {
    habit: string;
    order: number;
    days: Record<number, DayInfo>;
}

export interface HabitGroup {
    group?: string;
    streaks: HabitStreak[];
}

export enum DayStatus {
    Empty = 0,
    Successful = 1,
    Inherited = 2,
    PartiallyMarked = 3
}
