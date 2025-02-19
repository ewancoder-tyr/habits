using System.ComponentModel;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Habits.Api;

internal sealed record CreateHabit(
    [property: Description("Name of the habit. Should be unique.")]
    string Name,
    [property: Description("Amount of days that we don't need to do anything after we did the habit one time.")]
    int LengthDays);

public sealed class Habit
{
    [Description("Name of the habit")]
    public required string Name { get; set; }

    [Description("Amount of days that we don't need to do anything after we've done the habit one time.")]
    public required int LengthDays { get; set; }

    [Description("Marked days when we've actually done the habit.")]
    public required HashSet<int> Days { get; set; } = [];
}

internal sealed record Created(
    [property: Description("Identifier of a newly created habit. It is the same as the name of the habit.")]
    string Id);

public static class HabitsApi
{
    public static async ValueTask RegisterHabitsAsync(this IServiceCollection services)
    {
        var db = await Repository.LoadAsync();
        services.AddSingleton(db);
        services.AddTransient<UserScopedRepository>();
        services.AddHostedService<DataSaverHostedService>();
    }

    public static void AddHabitsApi(this WebApplication app)
    {
        var group = app.MapGroup("/api/habits")
            .WithTags("Habits")
            .RequireAuthorization();

        group.MapHabitsApi();
    }

    public static RouteGroupBuilder MapHabitsApi(this RouteGroupBuilder habitsGroup)
    {
        habitsGroup.MapGet("/", GetAllHabits);
        habitsGroup.MapGet("/{habitId}", GetHabit);
        habitsGroup.MapPut("/{habitId}", UpdateHabit);
        habitsGroup.MapPost("/", CreateHabit);
        habitsGroup.MapPost("/{habitId}/days/{day}", MarkDay);
        habitsGroup.MapDelete("/{habitId}/days/{day}", UnmarkDay);

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
        [Description("Identifier of the habit. Same as the habit's name.")]
        string habitId,
        UserScopedRepository repo)
    {
        var habits = repo.GetHabits();

        var habit = habits.Find(habit => habit.Name == habitId);
        if (habit is null)
            return TypedResults.NotFound();

        return TypedResults.Ok(habit);
    }

    [EndpointSummary("Update a habit")]
    [EndpointDescription("Updates information of the habit.")]
    private static Results<NotFound, BadRequest<string>, Ok<Habit>> UpdateHabit(
        [Description("Identifier of the habit. Same as the habit's name.")]
        string habitId,
        [Description("Habit information for an update.")]
        CreateHabit body,
        UserScopedRepository repo)
    {
        var habits = repo.GetHabits();

        var habit = habits.Find(habit => habit.Name == habitId);
        if (habit is null)
            return TypedResults.NotFound();

        if (body.Name != habit.Name && habits.Exists(habit => habit.Name == body.Name))
            return TypedResults.BadRequest("Habit with this name already exists.");

        habit.Name = body.Name;
        habit.LengthDays = body.LengthDays;
        repo.MarkNeedToSave();
        return TypedResults.Ok(habit);
    }

    [EndpointSummary("Create a new habit")]
    [EndpointDescription("Creates a new habit for current user.")]
    private static Results<NotFound, BadRequest<string>, Created<Created>> CreateHabit(
        [Description("A new habit information.")]
        CreateHabit body,
        UserScopedRepository repo)
    {
        var habits = repo.GetHabits();

        if (habits.Exists(habit => habit.Name == body.Name))
            return TypedResults.BadRequest("Habit with this name already exists.");

        var habit = new Habit
        {
            Name = body.Name,
            LengthDays = body.LengthDays,
            Days = []
        };

        repo.AddHabit(habit);
        repo.MarkNeedToSave();
        return TypedResults.Created("/api/habits", new Created(habit.Name));
    }

    [EndpointSummary("Mark a day")]
    [Description("Marks a day as if we did the habit on that day")]
    private static Results<NotFound, Ok<Habit>> MarkDay(
        [Description("Habit identifier. Same as habit name.")]
        string habitId,
        [Description("Day number, counted from 2020.")]
        int day,
        UserScopedRepository repo)
    {
        var habits = repo.GetHabits();

        var habit = habits.Find(habit => habit.Name == habitId);
        if (habit is null)
            return TypedResults.NotFound();

        habit.Days.Add(day);
        repo.MarkNeedToSave();
        return TypedResults.Ok(habit);
    }

    [EndpointSummary("Unmark a day")]
    [Description("Unmarks a day as if we did not do the habit on that day")]
    private static Results<NotFound, Ok<Habit>> UnmarkDay(
        [Description("Habit identifier. Same as habit name.")]
        string habitId,
        [Description("Day number, counted from 2020.")]
        int day,
        UserScopedRepository repo)
    {
        var habits = repo.GetHabits();

        var habit = habits.Find(habit => habit.Name == habitId);
        if (habit is null)
            return TypedResults.NotFound();

        habit.Days.Remove(day);
        repo.MarkNeedToSave();
        return TypedResults.Ok(habit);
    }
}
