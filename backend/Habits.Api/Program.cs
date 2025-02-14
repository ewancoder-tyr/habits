using System.Text.Json.Serialization;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Routing.Constraints;
using Microsoft.IdentityModel.Tokens;

var GoogleClient = "725292928539-ebtufhfemopng7t4akjd9tpatun9fkgd.apps.googleusercontent.com";
var builder = WebApplication.CreateSlimBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.TypeInfoResolver = SerializerContext.Default;
    options.SerializerOptions.Encoder = null; // Needed for fast path.
    //options.SerializerOptions.DefaultBufferSize = 16_000_000; // Probably needed for fast path.
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
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

Habit[] habits = [];

var apis = app.MapGroup("/").RequireAuthorization();
var habitsGroup = apis.MapGroup("/api/habits");
habitsGroup.MapGet("/", () => habits);

await app.RunAsync();

public sealed class Habit
{
    public string Id { get; set; } = null!;

    public required string Name { get; set; }

    public required int LengthDays { get; set; }

    public required IEnumerable<int> Days { get; set; } = [];
}

[JsonSerializable(typeof(Habit[]))]
internal partial class SerializerContext : JsonSerializerContext
{
}
