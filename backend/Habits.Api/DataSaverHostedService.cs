namespace Habits.Api;

public sealed class DataSaverHostedService(
    ILogger<DataSaverHostedService> logger,
    Repository db) : IHostedService, IDisposable
{
    private readonly CancellationTokenSource _cts = new();
    private CancellationTokenSource? _linkedCts;
    private Task? _saver;

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            _cts.Token, cancellationToken);

        _saver = Task.Run(async () =>
        {
            while (true)
            {
                _linkedCts.Token.ThrowIfCancellationRequested();

                await db.SaveIfNeedAsync(logger, _linkedCts.Token);
                await Task.Delay(TimeSpan.FromMinutes(1), _linkedCts.Token);
            }
        }, _linkedCts.Token);

        return Task.CompletedTask;
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
        _linkedCts?.Dispose();
    }
}
