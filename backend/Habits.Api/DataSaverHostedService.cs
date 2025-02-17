
using System.Collections.Concurrent;

namespace Habits.Api;

public sealed class DataSaverHostedService(
    ILogger<DataSaverHostedService> logger,
    Repository db) : IHostedService, IDisposable
{
    private readonly CancellationTokenSource _cts = new();
    private Task? _saver;

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _saver = Task.Run(async () =>
        {
            while (true)
            {
                cancellationToken.ThrowIfCancellationRequested();

                await db.SaveIfNeedAsync(_cts.Token, logger);
                await Task.Delay(TimeSpan.FromMinutes(1), _cts.Token);
            }
        });
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        await _cts.CancelAsync();
        if (_saver is not null)
            await _saver;
    }

    public void Dispose()
    {
        _cts.Dispose();
    }
}
