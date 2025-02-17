using System.ComponentModel;
using System.Security.Claims;
using System.Text.Json.Serialization;
using Habits.Api;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http.HttpResults;

var builder = WebApplication.CreateSlimBuilder(args);
var isDebug = false;
#if DEBUG
isDebug = true;
#endif

string ReadConfig(string name, string? debugValue = null)
{
    return builder.Configuration[name]
        ?? (isDebug ? debugValue : null)
        ?? throw new InvalidOperationException($"Cannot read {name} from configuration.");
}

var config = new TyrHostConfiguration(
    DataProtectionKeysPath: "/app/dataprotection",
    DataProtectionCertPath: "dp.pfx",
    DataProtectionCertPassword: ReadConfig("DpCertPassword", string.Empty),
    AuthCookieName: "HabitsAuthSession",
    CookiesDomain: ReadConfig("CookiesDomain", "habits.typingrealm.com"),
    AuthCookieExpiration: TimeSpan.FromDays(1.8),
    JwtIssuer: "https://accounts.google.com",
    JwtAudience: ReadConfig("JwtAudience", "725292928539-ebtufhfemopng7t4akjd9tpatun9fkgd.apps.googleusercontent.com"),
    SeqUri: ReadConfig("SeqUri", string.Empty),
    SeqApiKey: ReadConfig("SeqApiKey", string.Empty),
    LogVerboseNamespace: "Habits",
    CorsOrigins: ReadConfig("CorsOrigins", "http://localhost:4200;https://habits.typingrealm.com").Split(';'));

await builder.ConfigureTyrApplicationBuilderAsync(config);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.TypeInfoResolver = SerializerContext.Default;
    options.SerializerOptions.Encoder = null; // Needed for fast path.
    //options.SerializerOptions.DefaultBufferSize = 16_000_000; // Probably needed for fast path.
});

var app = builder.Build();
app.ConfigureTyrApplication(config);

var logger = app.Services.GetRequiredService<ILogger<HabitsApp>>();
logger.LogInformation("Starting the application");

var needToSave = false;
var db = new Dictionary<string, List<Habit>>();
if (!Directory.Exists("data"))
    Directory.CreateDirectory("data");
if (File.Exists("data/db"))
{
    logger.LogInformation("Found database file, loading the data.");
    var content = await File.ReadAllTextAsync("data/db");
    try
    {
        db = JsonSerializer.Deserialize(content, SerializerContext.Default.DictionaryStringListHabit);
        if (db is null) throw new InvalidOperationException("Could not deserialize the database");
    }
    catch (Exception exception)
    {
        logger.LogError(exception, "Could not load the database");
        throw;
    }
}

var saver = Task.Run(async () =>
{
    while (true)
    {
        if (needToSave)
        {
            try
            {
                logger.LogInformation("Changes were detected, saving the data");

                var serialized = JsonSerializer.Serialize(db, SerializerContext.Default.DictionaryStringListHabit);
                await File.WriteAllTextAsync("data/db", serialized);
                needToSave = false;
                logger.LogInformation("Successfully saved the data");
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Failed to save the data");
            }
        }

        await Task.Delay(TimeSpan.FromMinutes(1));
    }
});

var apis = app.MapGroup("/").RequireAuthorization();
var habitsGroup = apis.MapGroup("/api/habits")
    .WithTags("Habits");

var authGroup = apis.MapGroup("/api/auth").WithTags("Authentication");
authGroup.MapPost("/logout", async (HttpResponse _, HttpContext context) =>
{
    await context.SignOutAsync();
    context.Response.Cookies.Delete("AuthInfo");
})
    .WithSummary("Logout")
    .WithDescription("Signs out and deletes session cookie.");

habitsGroup.MapGet("/", (ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("User ID should not be null. This endpoint is protected with authentication.");

    if (db.TryGetValue($"google_{userId}", out var habits))
        return habits;

    return [];
})
    .WithSummary("Get all habits")
    .WithDescription("Gets all habits for current user.");

habitsGroup.MapGet("/{habitId}", Results<NotFound, Ok<Habit>> ([Description("Identifier of the habit.")]string habitId, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("User ID should not be null. This endpoint is protected with authentication.");

    if (!db.TryGetValue($"google_{userId}", out var habits))
        return TypedResults.NotFound();

    var habit = habits.Find(habit => habit.Name == habitId);
    if (habit is null)
        return TypedResults.NotFound();

    return TypedResults.Ok(habit);
})
    .WithSummary("Get a single habit")
    .WithDescription("Gets a single habit for current user.");

habitsGroup.MapPost("/", Results<NotFound, BadRequest<string>, Created<Created>> ([Description("A new habit information")]CreateHabit body, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("User ID should not be null. This endpoint is protected with authentication.");

    if (!db.TryGetValue($"google_{userId}", out var habits))
    {
        habits = new List<Habit>();
        db.Add($"google_{userId}", habits);
    }

    if (habits.Exists(habit => habit.Name == body.Name))
        return TypedResults.BadRequest("Habit with this name already exists.");

    var habit = new Habit
    {
        Name = body.Name,
        LengthDays = body.LengthDays,
        Days = []
    };

    habits.Add(habit);
    needToSave = true;
    return TypedResults.Created("/api/habits", new Created(habit.Name));
})
    .WithSummary("Create a new habit")
    .WithDescription("Creates a new habit for current user.");

habitsGroup.MapPut("/{id}", Results<NotFound, BadRequest<string>, Ok<Habit>> ([Description("Habit identifier. Same as the habit's name.")]string id, [Description("Habit information for an update.")]CreateHabit body, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("User ID should not be null. This endpoint is protected with authentication.");

    if (!db.TryGetValue($"google_{userId}", out var habits))
        return TypedResults.NotFound();

    var habit = habits.Find(habit => habit.Name == id);
    if (habit is null)
        return TypedResults.NotFound();

    if (body.Name != habit.Name && habits.Exists(habit => habit.Name == body.Name))
        return TypedResults.BadRequest("Habit with this name already exists.");

    habit.Name = body.Name;
    habit.LengthDays = body.LengthDays;
    needToSave = true;
    return TypedResults.Ok(habit);
})
    .WithSummary("Update a habit")
    .WithDescription("Updates information of the habit.");

habitsGroup.MapPost("/{id}/days/{day}", Results<NotFound, Ok<Habit>> ([Description("Habit identifier = habit name.")]string id, [Description("Day number to mark, counted from 2020.")]int day, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("User ID should not be null. This endpoint is protected with authentication.");

    if (!db.TryGetValue($"google_{userId}", out var habits))
        return TypedResults.NotFound();

    var habit = habits.Find(habit => habit.Name == id);
    if (habit is null)
        return TypedResults.NotFound();

    habit.Days.Add(day);
    needToSave = true;
    return TypedResults.Ok(habit);
})
    .WithSummary("Mark a day")
    .WithDescription("Marks a day as if we did the habit on that day.");

habitsGroup.MapDelete("/{id}/days/{day}", Results<NotFound, Ok<Habit>> ([Description("Habit identifier = habit name.")]string id, [Description("Day number to unmark, counted from 2020.")]int day, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("User ID should not be null. This endpoint is protected with authentication.");

    if (!db.TryGetValue($"google_{userId}", out var habits))
        return TypedResults.NotFound();

    var habit = habits.Find(habit => habit.Name == id);
    if (habit is null)
        return TypedResults.NotFound();

    habit.Days.Remove(day);
    needToSave = true;
    return TypedResults.Ok(habit);
})
    .WithSummary("Unmark a day")
    .WithDescription("Unmarks a day as if we did not do anything on it.");

await app.RunAsync();

internal sealed record CreateHabit(
    [property: Description("Name of the habit. Should be unique.")]
    string Name,
    [property: Description("Amount of days that we don't need to do anything after we did the habit one time.")]
    int LengthDays);

internal sealed class Habit
{
    [Description("Name of the habit")]
    public required string Name { get; set; }

    [Description("Amount of days that we don't need to do anything after we've done the habit one time.")]
    public required int LengthDays { get; set; }

    [Description("Marked days when we've actually done the habit.")]
    public required HashSet<int> Days { get; set; } = [];
}

[JsonSerializable(typeof(List<Habit>))]
[JsonSerializable(typeof(Created))]
[JsonSerializable(typeof(CreateHabit))]
[JsonSerializable(typeof(Dictionary<string, List<Habit>>))]
internal partial class SerializerContext : JsonSerializerContext
{
}

internal sealed record Created(
    [property: Description("Identifier of a newly created habit. It is the same as the name of the habit.")]
    string Id);

/// <summary>
/// A stub class for logging context.
/// </summary>
internal sealed record HabitsApp();

