using System.Text.Json.Serialization;
using Habits.Api;
using Tyr.Framework;

var builder = WebApplication.CreateSlimBuilder(args);
var isDebug = false;
#if DEBUG
isDebug = true;
#endif

// Needed for AOT apps.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.TypeInfoResolver = SerializerContext.Default;
    options.SerializerOptions.Encoder = null; // Needed for fast path.
    //options.SerializerOptions.DefaultBufferSize = 16_000_000; // Probably needed for fast path.
});

var config = TyrHostConfiguration.Default(
    builder.Configuration,
    "Habits",
    isDebug: isDebug);

// Adds generic host shared between pet projects.
await builder.ConfigureTyrApplicationBuilderAsync(config);

// Adds domain-specific services.
await builder.Services.RegisterHabitsAsync();

var app = builder.Build();

// Configures generic host shared between pet projects.
app.ConfigureTyrApplication(config);

// Configures domain-specific concerns.
app.AddHabitsApi();

await app.RunAsync();

// Needed for AOT apps.
[JsonSerializable(typeof(List<Habit>))]
[JsonSerializable(typeof(Created))]
[JsonSerializable(typeof(CreateHabit))]
[JsonSerializable(typeof(Dictionary<string, List<Habit>>))]
[JsonSerializable(typeof(DateTime))]
internal partial class SerializerContext : JsonSerializerContext
{
}
