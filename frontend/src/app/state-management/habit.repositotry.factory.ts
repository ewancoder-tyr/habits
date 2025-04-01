import { Injectable, Signal, computed } from '@angular/core';
import { ApiHabitRepository } from './api.habit.repository';
import { ModeService } from './mode.service';
import { Mode } from './mode.service';
import { IHabitRepository } from './habit.repository';
import { LocalHabitRepository } from './local.habit.repository';
import { Observable, of } from 'rxjs';
import { CreateHabit, Habit, UpdateHabit } from './models';

@Injectable({ providedIn: 'root' })
export class HabitRepositoryFactory {
    repoSignal: Signal<IHabitRepository>;

    constructor(
        private modeService: ModeService,
        private localRepo: LocalHabitRepository,
        private apiRepo: ApiHabitRepository
    ) {
        this.repoSignal = computed(() => {
            const mode = this.modeService.modeSignal();
            if (mode === Mode.Server) return this.apiRepo;
            if (mode === Mode.Local) return this.localRepo;

            console.log('Mode is not selected yet, doing nothing.');
            return new DoNothingHabitRepository();
        });
    }
}

// A hacky way to make it work for now.
class DoNothingHabitRepository implements IHabitRepository {
    getAll(): Observable<Habit[]> {
        return of([]);
    }
    create(createHabit: CreateHabit): Observable<Habit> {
        return of<Habit>(undefined!);
    }
    update(habitId: string, updateHabit: UpdateHabit): Observable<Habit> {
        return of<Habit>(undefined!);
    }
    markDay(habitId: string, day: number): Observable<Habit> {
        return of<Habit>(undefined!);
    }
    unmarkDay(habitId: string, day: number): Observable<Habit> {
        return of<Habit>(undefined!);
    }
    remove(habitId: string): Observable<void> {
        return of();
    }
}
