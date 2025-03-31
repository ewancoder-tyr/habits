import { computed, Injectable, signal } from '@angular/core';
import { StreakDay } from './streak-day/streak-day.component';
import { CachedHabitRepository, Habit, UpdateHabit } from './habit-repository.service';

@Injectable({ providedIn: 'root' })
export class StreaksService {
    private earliestSupportedYear = 2020;
    public groupsSignal = signal<HabitGroup[]>([]);
    public streaksSignal = signal<HabitStreak[]>([]);

    constructor(private repo: CachedHabitRepository) {
        this.repo.getAll().subscribe(habits => this.recalculateStreaks(habits));
    }

    public updateHabit(id: string, update: UpdateHabit) {
        this.repo.update(id, update).subscribe();
    }

    public mark(day: StreakDay) {
        this.repo.markDay(day.habit, day.id).subscribe();
    }

    public unmark(day: StreakDay) {
        this.repo.unmarkDay(day.habit, day.id).subscribe();
    }

    public createHabit(habit: string, length: number) {
        this.repo
            .create({
                name: habit,
                lengthDays: length
            })
            .subscribe();
    }

    public removeHabit(habit: string) {
        this.repo.remove(habit).subscribe();
    }

    public getMonthDaysSignal(year: number, month: number, group?: string) {
        const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth();
        const startingDayNumber = this.getStartingDayNumber(year, month);
        const daysAmount = this.getDaysInMonth(year, month);
        const monthDaysSignal = computed(() => {
            const groups = this.groupsSignal();

            const data = groups.find(g => g.group === group)?.streaks ?? [];
            // TODO: throw an error when empty.

            const days: Record<string, StreakDay[]> = {};
            for (let i = 0; i < daysAmount; i++) {
                for (const habitData of data) {
                    if (!days[habitData.habit]) days[habitData.habit] = [];

                    const dayInfo = habitData.days[i + startingDayNumber] ?? {
                        status: DayStatus.Empty,
                        timesDone: 0,
                        timesNeeded: 0
                    };

                    const day: StreakDay = {
                        id: i + startingDayNumber,
                        day: i + 1,
                        habit: habitData.habit,
                        info: dayInfo
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

    private recalculateStreaks(streaks: Habit[]) {
        const calculated = streaks
            .map(streak => {
                const calculatedDays = this.calculateDays(streak.days, streak.lengthDays);
                return {
                    habit: streak.name,
                    days: calculatedDays.days,
                    order: calculatedDays.order,
                    group: streak.group
                };
            })
            .sort((a, b) => (a.order === b.order ? a.habit.localeCompare(b.habit) : a.order - b.order));

        const groups: HabitGroup[] = [];
        for (let streak of calculated) {
            console.log(streak.group);
            let group = groups.find(g => g.group === streak.group);
            if (!group) {
                group = {
                    group: streak.group,
                    streaks: []
                };
                groups.push(group);
            }

            group.streaks.push(streak);
        }

        this.streaksSignal.set(calculated);
        this.groupsSignal.set(
            groups.sort((a, b) => {
                const aS = a.group ? a.group : 'zzzzzz';
                const bS = b.group ? b.group : 'zzzzzz';

                return aS.localeCompare(bS);
            })
        );
    }

    private calculateDays(days: number[], lengthDays: number): { days: Record<number, DayInfo>; order: number } {
        const sortedDays = days.sort((a, b) => a - b);
        const resultDays: Record<number, DayInfo> = {};

        let order = 0;
        let timesNeeded = lengthDays > 1000 ? lengthDays - 1000 : 1;
        for (const day of sortedDays) {
            if (timesNeeded === 1) {
                order = day + lengthDays;
                resultDays[day] = {
                    status: DayStatus.Successful,
                    timesDone: 1,
                    timesNeeded: 1
                };

                for (let additionalDay = 1; additionalDay < lengthDays; additionalDay++) {
                    resultDays[day + additionalDay] = {
                        status: DayStatus.Inherited,
                        timesDone: 0,
                        timesNeeded: 0
                    };
                }
            } else {
                const result = resultDays[day] ?? {
                    status: DayStatus.Empty,
                    timesDone: 0,
                    timesNeeded: timesNeeded
                };

                result.timesDone++;
                if (result.timesDone >= result.timesNeeded) {
                    order = day + 1;
                    result.status = DayStatus.Successful;
                } else if (result.timesDone > 0) {
                    result.status = DayStatus.PartiallyMarked;
                }
                resultDays[day] = result;
            }
        }

        return { days: resultDays, order: order };
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

/*interface UpdateHabit {
    name: string;
    lengthDays: number;
    group: string | null;
}*/

/*interface HabitStreakData {
    name: string;
    group?: string;
    lengthDays: number;
    days: number[];
}*/
