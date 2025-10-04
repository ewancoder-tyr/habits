export interface Habit {
    name: string;
    group?: string;
    lengthDays: number;
    days: number[];
}

export interface CreateHabit {
    name: string;
    group?: string;
    lengthDays: number;
}

export interface UpdateHabit {
    name: string;
    group?: string;
    lengthDays: number;
}
export interface HabitCreated {
    id: string;
}
