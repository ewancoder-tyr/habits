import { Observable } from 'rxjs';
import { Habit, CreateHabit, UpdateHabit } from './models';

export interface IHabitRepository {
    getAll(): Observable<Habit[]>;
    create(createHabit: CreateHabit): Observable<Habit>;
    update(habitId: string, updateHabit: UpdateHabit): Observable<Habit>;
    markDay(habitId: string, day: number): Observable<Habit>;
    unmarkDay(habitId: string, day: number): Observable<Habit>;
    remove(habitId: string): Observable<void>;
}
