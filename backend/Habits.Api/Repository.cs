namespace Habits.Api;

public sealed class UserScopedRepository(Repository repo, User user)
{
    public List<Habit> GetHabits()
        => repo.GetHabitsForUser(user.UserId);

    public void AddHabit(Habit habit)
        => repo.AddHabit(user.UserId, habit);

    public void MarkNeedToSave()
        => repo.MarkNeedToSave();
}

public sealed class Repository
{
    private bool _needToSave;
    private readonly Dictionary<string, List<Habit>> _db;
    private readonly Lock _lock = new();
    private Repository(Dictionary<string, List<Habit>> db) => _db = db;

    public static async ValueTask<Repository> LoadAsync()
    {
        if (!Directory.Exists("data"))
            Directory.CreateDirectory("data");

        if (!File.Exists("data/db"))
            return new(new());

        var content = await File.ReadAllTextAsync("data/db");
        try
        {
            var db = JsonSerializer.Deserialize(
                content, SerializerContext.Default.DictionaryStringListHabit);

            return db is null
                ? throw new InvalidOperationException("Could not deserialize the database.")
                : new(db);
        }
        catch (Exception exception)
        {
            // TODO: Properly log it.
            Console.WriteLine(exception);
            throw;
        }
    }

    public List<Habit> GetHabitsForUser(string userId)
    {
        lock (_lock)
        {
            if (_db.TryGetValue(userId, out var habits))
                return habits;
        }

        return [];
    }

    public void AddHabit(string userId, Habit habit)
    {
        lock (_lock)
        {
            if (_db.TryGetValue(userId, out var habits))
                habits.Add(habit);
            else
            {
                var newHabits = new List<Habit>
                {
                    habit
                };
                _db.Add(userId, newHabits);
            }
        }
    }

    public void MarkNeedToSave() => _needToSave = true;

    public async ValueTask SaveIfNeedAsync(ILogger<DataSaverHostedService> logger, CancellationToken cancellationToken)
    {
        _ = cancellationToken;

        if (!_needToSave)
            return;

        logger.LogInformation("Need to save. Saving the database");
        var neededToSave = false;
        try
        {
            neededToSave = _needToSave;
            _needToSave = false;
            Dictionary<string, List<Habit>> db;
            lock (_lock)
            {
                db = _db.ToDictionary();
            }

            var serialized = JsonSerializer.Serialize(db, SerializerContext.Default.DictionaryStringListHabit);

            // Do not pass cancellation token here, let it finish the write.
            await File.WriteAllTextAsync("data/db", serialized, cancellationToken: default);
            logger.LogInformation("Successfully saved the data");
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Could not save the database");
            _needToSave = _needToSave ? _needToSave : neededToSave;
            throw;
        }
    }
}
