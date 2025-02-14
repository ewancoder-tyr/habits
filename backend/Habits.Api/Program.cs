using System.Text.Json.Serialization;

var builder = WebApplication.CreateSlimBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.TypeInfoResolver = SerializerContext.Default;
    options.SerializerOptions.Encoder = null; // Needed for fast path.
    //options.SerializerOptions.DefaultBufferSize = 16_000_000; // Probably needed for fast path.
});

var app = builder.Build();

Habit[] habits = [
    new Habit {
        Id = "id",
        Name = "name"
    }
];

var habitsGroup = app.MapGroup("/api/habits");
habitsGroup.MapGet("/", () => habits);

await app.RunAsync();

public sealed class Habit
{
    public string Id { get; set; } = null!;

    public required string Name { get; set; }
}

[JsonSerializable(typeof(Habit[]))]
internal partial class SerializerContext : JsonSerializerContext
{
}
