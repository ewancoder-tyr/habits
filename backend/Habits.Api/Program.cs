using System.Security.Claims;
using System.Text.Json.Serialization;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using Serilog;
using Serilog.Events;

var GoogleClient = "725292928539-ebtufhfemopng7t4akjd9tpatun9fkgd.apps.googleusercontent.com";
var builder = WebApplication.CreateSlimBuilder(args);
builder.Services.AddOpenApi();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.TypeInfoResolver = SerializerContext.Default;
    options.SerializerOptions.Encoder = null; // Needed for fast path.
    //options.SerializerOptions.DefaultBufferSize = 16_000_000; // Probably needed for fast path.
});

builder.Services.AddCors();

builder.Services.AddAuthentication()
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters.ValidIssuer = "https://accounts.google.com";
        o.TokenValidationParameters.ValidAudience = GoogleClient;
        o.TokenValidationParameters.SignatureValidator = delegate (string token, TokenValidationParameters parameters)
        {
            GoogleJsonWebSignature.ValidateAsync(token, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [GoogleClient]
            });

            return new Microsoft.IdentityModel.JsonWebTokens.JsonWebToken(token);
        };
    });
builder.Services.AddAuthorization();

builder.Host.UseSerilog((context, config) =>
{
    config
        .MinimumLevel.Information()
        .MinimumLevel.Override("Habits", LogEventLevel.Verbose)
        .WriteTo.Console();

#if !DEBUG
    config.WriteTo.Seq(
        builder.Configuration["SeqUri"] ?? throw new InvalidOperationException("Cannot read seq uri secret."),
        apiKey: builder.Configuration["SeqApiKey"]);
#endif
});

var app = builder.Build();

app.MapOpenApi();
app.MapScalarApiReference("docs");

app.UseCors(builder => builder
    .WithOrigins("http://localhost:4200", "https://habits.typingrealm.com")
    .AllowAnyMethod()
    .WithHeaders("Authorization", "Content-Type"));

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
var habitsGroup = apis.MapGroup("/api/habits");
habitsGroup.MapGet("/", (ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("User ID should not be null. This endpoint is protected with authentication.");

    if (db.TryGetValue($"google_{userId}", out var habits))
        return habits;

    return [];
});
habitsGroup.MapGet("/{habitId}", Results<NotFound, Ok<Habit>> (string habitId, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("User ID should not be null. This endpoint is protected with authentication.");

    if (!db.TryGetValue($"google_{userId}", out var habits))
        return TypedResults.NotFound();

    var habit = habits.Find(habit => habit.Name == habitId);
    if (habit is null)
        return TypedResults.NotFound();

    return TypedResults.Ok(habit);
});
habitsGroup.MapPost("/", Results<NotFound, BadRequest<string>, Created<Created>> (CreateHabit body, ClaimsPrincipal user) =>
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
});
habitsGroup.MapPut("/{id}", Results<NotFound, BadRequest<string>, Ok<Habit>> (string id, CreateHabit body, ClaimsPrincipal user) =>
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
});
habitsGroup.MapPost("/{id}/days/{day}", Results<NotFound, Ok<Habit>> (string id, int day, ClaimsPrincipal user) =>
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
});
habitsGroup.MapDelete("/{id}/days/{day}", Results<NotFound, Ok<Habit>> (string id, int day, ClaimsPrincipal user) =>
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
});

await app.RunAsync();

internal sealed class CreateHabit
{
    public required string Name { get; set; }
    public required int LengthDays { get; set; }
}

internal sealed class Habit
{
    public required string Name { get; set; }

    public required int LengthDays { get; set; }

    public required HashSet<int> Days { get; set; } = [];
}

[JsonSerializable(typeof(List<Habit>))]
[JsonSerializable(typeof(Created))]
[JsonSerializable(typeof(CreateHabit))]
[JsonSerializable(typeof(Dictionary<string, List<Habit>>))]
internal partial class SerializerContext : JsonSerializerContext
{
}

internal sealed record Created(string Id);

/// <summary>
/// A stub class for logging context.
/// </summary>
internal sealed record HabitsApp();
