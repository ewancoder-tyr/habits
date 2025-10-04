import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { HabitCreated } from './models';
import { IHabitRepository } from './habit.repository';
import { Habit, CreateHabit, UpdateHabit } from './models';

@Injectable({ providedIn: 'root' })
export class ApiHabitRepository implements IHabitRepository {
    private habitsUri = 'https://api.habits.typingrealm.com/api/habits';
    constructor(private http: HttpClient) {}

    getAll(): Observable<Habit[]> {
        return this.http.get<Habit[]>(this.habitsUri);
    }

    create(createHabit: CreateHabit): Observable<Habit> {
        return this.http
            .post<HabitCreated>(this.habitsUri, createHabit)
            .pipe(switchMap(habitCreated => this.http.get<Habit>(`${this.habitsUri}/${habitCreated.id}`)));
    }

    update(habitId: string, updateHabit: UpdateHabit): Observable<Habit> {
        return this.http.put<Habit>(`${this.habitsUri}/${habitId}`, updateHabit);
    }

    markDay(habitId: string, day: number): Observable<Habit> {
        return this.http.post<Habit>(`${this.habitsUri}/${habitId}/days/${day}`, null);
    }

    unmarkDay(habitId: string, day: number): Observable<Habit> {
        return this.http.delete<Habit>(`${this.habitsUri}/${habitId}/days/${day}`);
    }

    remove(habitId: string): Observable<void> {
        return this.http.delete<void>(`${this.habitsUri}/${habitId}`);
    }
}
