import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { IHabitRepository } from './habit.repository';
import { Habit, CreateHabit, UpdateHabit } from './models';

@Injectable({ providedIn: 'root' })
export class LocalHabitRepository implements IHabitRepository {
    private localStorageKey = 'tyr_habits_data';

    getAll(): Observable<Habit[]> {
        const data = this.getData();

        return of(data);
    }

    create(createHabit: CreateHabit): Observable<Habit> {
        const data = this.getData();

        if (data.find(habit => habit.name === createHabit.name)) {
            throw new Error('Habit with this name already exists.');
        }

        const habit: Habit = {
            name: createHabit.name,
            group: createHabit.group,
            lengthDays: createHabit.lengthDays,
            days: []
        };

        data.push(habit);
        this.saveData(data);
        console.log(data);

        return of(habit);
    }

    update(habitId: string, updateHabit: UpdateHabit): Observable<Habit> {
        const data = this.getData();
        const habits = data.filter(habit => habit.name === habitId);
        if (habits.length !== 1) throw new Error('Habit with this Id was not found or multiple habits found.');
        const habit = habits[0];

        habit.name = updateHabit.name;
        habit.group = updateHabit.group;
        habit.lengthDays = updateHabit.lengthDays;

        this.saveData(data);
        return of(habit);
    }

    markDay(habitId: string, day: number): Observable<Habit> {
        const data = this.getData();
        const habits = data.filter(habit => habit.name === habitId);
        if (habits.length !== 1) throw new Error('Habit with this Id was not found or multiple habits found.');
        const habit = habits[0];

        habit.days.push(day);

        this.saveData(data);
        return of(habit);
    }

    unmarkDay(habitId: string, day: number): Observable<Habit> {
        const data = this.getData();
        const habits = data.filter(habit => habit.name === habitId);
        if (habits.length !== 1) throw new Error('Habit with this Id was not found or multiple habits found.');
        const habit = habits[0];

        const index = habit.days.lastIndexOf(day);
        if (index !== -1) habit.days.splice(index, 1);

        this.saveData(data);
        return of(habit);
    }

    remove(habitId: string): Observable<void> {
        const data = this.getData();
        const habits = data.filter(habit => habit.name === habitId);
        if (habits.length !== 1) throw new Error('Habit with this Id was not found or multiple habits found.');

        const index = data.indexOf(habits[0]);
        data.splice(index, 1);

        this.saveData(data);
        return of(undefined);
    }

    private getData(): Habit[] {
        const data = localStorage.getItem(this.localStorageKey) ?? '[]';
        const parsed = JSON.parse(data) as Habit[];
        return parsed;
    }

    private saveData(habits: Habit[]) {
        const json = JSON.stringify(habits);
        localStorage.setItem(this.localStorageKey, json);
    }
}
