import { Injectable, effect } from '@angular/core';
import { BehaviorSubject, Observable, switchMap, tap, of } from 'rxjs';
import { IHabitRepository } from './habit.repository';
import { HabitRepositoryFactory } from './habit.repositotry.factory';
import { Habit, CreateHabit, UpdateHabit } from './models';

@Injectable({ providedIn: 'root' })
export class CachedHabitRepository implements IHabitRepository {
    private data = new BehaviorSubject<Habit[]>([]);
    private repo: IHabitRepository;

    constructor(repoFactory: HabitRepositoryFactory) {
        this.repo = repoFactory.repoSignal();
        effect(() => {
            console.log('Resetting the data. Got a new repository.');
            this.data.next([]);
            this.repo = repoFactory.repoSignal();

            // Re-trigger getting all the data.
            this.getData().subscribe();
        });
    }

    getAll(): Observable<Habit[]> {
        console.log('Getting all habits observable.');
        return this.getData().pipe(switchMap(() => this.data.asObservable()));
    }

    create(createHabit: CreateHabit): Observable<Habit> {
        return this.getData().pipe(
            switchMap(() => this.repo.create(createHabit)),
            tap(habit => this.addHabit(habit))
        );
    }

    update(habitId: string, updateHabit: UpdateHabit): Observable<Habit> {
        return this.getData().pipe(
            switchMap(() => this.repo.update(habitId, updateHabit)),
            tap(habit => this.updateHabit(habitId, habit))
        );
    }

    markDay(habitId: string, day: number): Observable<Habit> {
        return this.getData().pipe(
            switchMap(() => this.repo.markDay(habitId, day)),
            tap(habit => this.updateHabit(habitId, habit))
        );
    }

    unmarkDay(habitId: string, day: number): Observable<Habit> {
        return this.getData().pipe(
            switchMap(() => this.repo.unmarkDay(habitId, day)),
            tap(habit => this.updateHabit(habitId, habit))
        );
    }

    remove(habitId: string): Observable<void> {
        return this.getData().pipe(
            switchMap(() => this.repo.remove(habitId)),
            tap(() => this.deleteHabit(habitId))
        );
    }

    private getData(): Observable<Habit[]> {
        if (this.data.value.length > 0) return of(this.data.value);

        return this.repo.getAll().pipe(
            tap(data => {
                console.log('Retrieved ALL data from Repository', data);
                this.data.next(data);
            })
        );
    }

    private addHabit(habit: Habit) {
        this.data.value.push(habit);
        this.data.next(this.data.value);
    }

    private deleteHabit(habitId: string) {
        const existing = this.data.value.find(h => h.name === habitId);
        if (existing) {
            const index = this.data.value.indexOf(existing);
            if (index !== -1) {
                this.data.value.splice(index, 1);
                this.data.next(this.data.value);
            }
        }
    }

    private updateHabit(habitId: string, habit: Habit) {
        console.log('updating cached value', this.data.value, habit);
        const existing = this.data.value.find(h => h.name === habitId);
        if (!existing) throw new Error('Existing habit not found.');

        this.data.value.splice(this.data.value.indexOf(existing), 1);
        this.data.value.push(habit);
        this.data.next(this.data.value);
    }
}
