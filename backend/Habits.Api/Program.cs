using System.Security.Claims;
using System.Text.Json.Serialization;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing.Constraints;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.Annotations;

var GoogleClient = "725292928539-ebtufhfemopng7t4akjd9tpatun9fkgd.apps.googleusercontent.com";
var builder = WebApplication.CreateSlimBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.TypeInfoResolver = SerializerContext.Default;
    options.SerializerOptions.Encoder = null; // Needed for fast path.
    //options.SerializerOptions.DefaultBufferSize = 16_000_000; // Probably needed for fast path.
});

builder.Services.AddCors();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.EnableAnnotations();

    // Show a field for entering access token.
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Access token",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    // Send this access token value in every request.
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type  = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            []
        }
    });
});
builder.Services.Configure<RouteOptions>(options =>
{
    // Needed for Swagger.
    options.SetParameterPolicy<RegexInlineRouteConstraint>("regex");
});

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

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors(builder => builder
    .WithOrigins("http://localhost:4200", "https://habits.typingrealm.com")
    .AllowAnyMethod()
    .WithHeaders("Authorization", "Content-Type"));

var db = new Dictionary<string, List<Habit>>();

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
habitsGroup.MapPost("/", Results<NotFound, BadRequest<string>, Created<Created>> (Habit body, ClaimsPrincipal user) =>
{
    body.Days = []; // Do not accept it as an input.

    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("User ID should not be null. This endpoint is protected with authentication.");

    if (!db.TryGetValue($"google_{userId}", out var habits))
    {
        habits = new List<Habit>();
        db.Add($"google_{userId}", habits);
    }

    if (habits.Exists(habit => habit.Name == body.Name))
        return TypedResults.BadRequest("Habit with this name already exists.");

    body.Id = Guid.NewGuid().ToString();
    habits.Add(body);
    return TypedResults.Created("/api/habits", new Created(body.Id));
});
habitsGroup.MapPut("/{id}", Results<NotFound, Ok<Habit>> (string id, Habit body, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("User ID should not be null. This endpoint is protected with authentication.");

    if (!db.TryGetValue($"google_{userId}", out var habits))
        return TypedResults.NotFound();

    var habit = habits.Find(habit => habit.Id == id);
    if (habit is null)
        return TypedResults.NotFound();

    habit.Name = body.Name;
    habit.LengthDays = body.LengthDays;
    return TypedResults.Ok(habit);
});
habitsGroup.MapPost("/{id}/days/{day}", Results<NotFound, Ok<Habit>> (string id, int day, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("User ID should not be null. This endpoint is protected with authentication.");

    if (!db.TryGetValue($"google_{userId}", out var habits))
        return TypedResults.NotFound();

    var habit = habits.Find(habit => habit.Id == id);
    if (habit is null)
        return TypedResults.NotFound();

    habit.Days.Add(day);
    return TypedResults.Ok(habit);
});
habitsGroup.MapDelete("/{id}/days/{day}", Results<NotFound, Ok<Habit>> (string id, int day, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("User ID should not be null. This endpoint is protected with authentication.");

    if (!db.TryGetValue($"google_{userId}", out var habits))
        return TypedResults.NotFound();

    var habit = habits.Find(habit => habit.Id == id);
    if (habit is null)
        return TypedResults.NotFound();

    habit.Days.Remove(day);
    return TypedResults.Ok(habit);
});

await app.RunAsync();

internal sealed class Habit
{
    [SwaggerSchema(ReadOnly = true)]
    public string Id { get; set; } = null!;

    public required string Name { get; set; }

    public required int LengthDays { get; set; }

    [SwaggerSchema(ReadOnly = true)]
    public HashSet<int> Days { get; set; } = [];
}

[JsonSerializable(typeof(List<Habit>))]
[JsonSerializable(typeof(Created))]
internal partial class SerializerContext : JsonSerializerContext
{
}

internal sealed record Created(string Id);
