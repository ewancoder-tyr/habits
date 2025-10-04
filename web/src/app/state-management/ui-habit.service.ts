import { Injectable, signal, WritableSignal } from '@angular/core';
import { CachedHabitRepository } from './cached.habit.repository';
import { Habit } from './models';

@Injectable({ providedIn: 'root' })
export class UiHabitService {
    public groupedHabitsSignal: WritableSignal<UiHabitGroup[]> = signal([]);

    constructor(repo: CachedHabitRepository) {
        repo.getAll().subscribe(habits => {
            const groupedHabits = this.mapToUiHabitGroups(habits);
            this.groupedHabitsSignal.set(groupedHabits);
        });
    }

    private mapToUiHabitGroups(habits: Habit[]): UiHabitGroup[] {
        const uiHabits = habits.map(habit => this.mapToUiHabit(habit));
        const sortedHabits = uiHabits.sort(sortHabits);
        const groupedHabits = this.splitIntoGroups(sortedHabits);

        return groupedHabits;
    }

    private mapToUiHabit(habit: Habit): UiHabit {
        const sortedDays = habit.days.sort((a, b) => a - b);
        const streakDays: Record<number, DayInfo> = {};

        let order = 0;
        const timesNeeded = habit.lengthDays > 1000 ? habit.lengthDays - 1000 : 1;
        for (const day of sortedDays) {
            if (timesNeeded === 1) {
                order = day + habit.lengthDays;
                streakDays[day] = {
                    status: DayStatus.Successful,
                    timesDone: 1,
                    timesNeeded: 1
                };

                for (let additionalDay = 1; additionalDay < habit.lengthDays; additionalDay++) {
                    streakDays[day + additionalDay] = {
                        status: DayStatus.Inherited,
                        timesDone: 0,
                        timesNeeded: 0
                    };
                }
            } else {
                const currentResult = streakDays[day] ?? {
                    status: DayStatus.Empty,
                    timesDone: 0,
                    timesNeeded: timesNeeded
                };

                currentResult.timesDone++;
                if (currentResult.timesDone >= currentResult.timesNeeded) {
                    order = day + 1;
                    currentResult.status = DayStatus.Successful;
                } else if (currentResult.timesDone > 0) {
                    currentResult.status = DayStatus.PartiallyMarked;
                }
                streakDays[day] = currentResult;
            }
        }

        return {
            ...habit,
            streakDays: streakDays,
            order: order
        };
    }

    private splitIntoGroups(habits: UiHabit[]): UiHabitGroup[] {
        const groups: UiHabitGroup[] = [];

        for (const habit of habits) {
            let group = groups.find(g => g.group === habit.group);
            if (!group) {
                group = {
                    group: habit.group,
                    habits: []
                };
                groups.push(group);
            }

            group.habits.push(habit);
        }

        return groups.sort((a, b) => {
            const sA = a.group ?? 'zzzzz';
            const sB = b.group ?? 'zzzzz';

            return sA.localeCompare(sB);
        });
    }
}

function sortHabits(a: UiHabit, b: UiHabit) {
    return a.order === b.order ? a.name.localeCompare(b.name) : a.order - b.order;
}

interface UiHabit extends Habit {
    streakDays: Record<number, DayInfo>;
    order: number;
}

export interface UiHabitGroup {
    group?: string;
    habits: UiHabit[];
}

export interface DayInfo {
    status: DayStatus;
    timesDone: number;
    timesNeeded: number;
}

export enum DayStatus {
    Empty = 0,
    Successful = 1,
    Inherited = 2,
    PartiallyMarked = 3
}
