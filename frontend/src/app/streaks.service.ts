import { computed, Injectable, Signal } from '@angular/core';
import { StreakDay } from './streak-day/streak-day.component';
import { UiHabitService } from './state-management/ui-habit.service';

@Injectable({ providedIn: 'root' })
export class StreaksService {
    private earliestSupportedYear = 2020;

    constructor(private uiHabitService: UiHabitService) {}

    public getMonthDaysSignal(year: number, month: number, group?: string) {
        const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth();
        const startingDayId = this.getStartingDayNumber(year, month);
        const daysAmount = this.getDaysInMonth(year, month);
        const monthDaysSignal = computed(() => {
            const groups = this.uiHabitService.groupedHabitsSignal();
            const habits = groups.find(g => g.group === group)?.habits ?? [];

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
