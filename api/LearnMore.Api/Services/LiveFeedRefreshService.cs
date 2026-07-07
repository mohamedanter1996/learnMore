namespace LearnMore.Api.Services;

/// <summary>
/// Refreshes the live tech feeds on startup and every 12 hours.
/// Failures are non-fatal — offline just keeps the cached/seed content.
/// </summary>
public class LiveFeedRefreshService(LiveFeedService feed, ILogger<LiveFeedRefreshService> logger)
    : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(12);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                await feed.RefreshAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Live feed refresh cycle failed.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
