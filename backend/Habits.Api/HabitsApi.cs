using System.ComponentModel;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Habits.Api;

public static class HabitsApi
{
    public static RouteGroupBuilder MapHabitsApi(this RouteGroupBuilder habitsGroup)
    {
        habitsGroup.MapGet("/", GetAllHabits);
        habitsGroup.MapGet("/{habitId}", GetHabit);
        return habitsGroup;
    }

    [EndpointSummary("Get all habits")]
    [EndpointDescription("Gets all habits for current user.")]
    private static Ok<List<Habit>> GetAllHabits(
        UserScopedRepository repo)
    {
        return TypedResults.Ok(repo.GetHabits());
    }

    [EndpointSummary("Get a single habit")]
    [EndpointDescription("Gets a single habit for current user.")]
    private static Results<NotFound, Ok<Habit>> GetHabit(
        [Description("Identifier of the habit.")]
        string habitId,
        UserScopedRepository repo)
    {
        var habits = repo.GetHabits();

        var habit = habits.Find(habit => habit.Name == habitId);
        if (habit is null)
            return TypedResults.NotFound();

        return TypedResults.Ok(habit);
    }
}
