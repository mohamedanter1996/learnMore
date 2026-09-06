using Anthropic;
using Anthropic.Exceptions;
using LearnMore.Api.Data;
using LearnMore.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LearnMore.Api.Services;

public record CoachStatusDto(
    bool Connected, string? KeyHint, string Model, string? LastError,
    DateTime? LastCallAt, int CallsToday, int DailyLimit);

public record SaveKeyDto(string Key);
public record SetModelDto(string Model);

/// <summary>
/// Owns the Anthropic API key and the spend cap around it.
///
/// The key is never returned by any endpoint, never logged, and never turned into a string
/// anywhere except the one line that hands it to the SDK client. There is no scrubber, because
/// a scrubber would imply the key might have leaked into a message in the first place.
/// </summary>
public class CoachService(AppDbContext db)
{
    /// <summary>Grading calls allowed per day. The API binds localhost with no authentication and
    /// now fronts a billable endpoint, so a runaway retry loop has to hit a wall somewhere.</summary>
    public const int DailyLimit = 60;

    /// <summary>Models offered in Settings. A picker, not a free-text field, so a typo cannot
    /// turn into a 404 halfway through a run.</summary>
    public static readonly string[] AllowedModels =
        ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"];

    private static DateOnly Today => DateOnly.FromDateTime(DateTime.Now);

    public async Task<CoachSettings> GetRowAsync()
    {
        var row = await db.CoachSettings.FirstOrDefaultAsync();
        if (row is null)
        {
            row = new CoachSettings();
            db.CoachSettings.Add(row);
            await db.SaveChangesAsync();
        }
        return row;
    }

    public async Task<CoachStatusDto> GetStatusAsync()
    {
        var row = await GetRowAsync();
        return new CoachStatusDto(
            row.ApiKeyProtected is not null, row.KeyHint, row.Model, row.LastError,
            row.LastCallAt, row.CallsDate == Today ? row.CallsToday : 0, DailyLimit);
    }

    /// <summary>
    /// Verifies the key against the Models endpoint before storing it — free, and it turns a typo
    /// into an error now instead of thirty seconds into your first scenario.
    /// </summary>
    public async Task<(bool Ok, string? Error, CoachStatusDto? Status)> SaveKeyAsync(SaveKeyDto dto)
    {
        var key = (dto.Key ?? "").Trim();
        if (key.Length < 20) return (false, "That does not look like an API key.", null);

        var row = await GetRowAsync();

        try
        {
            var client = new AnthropicClient { ApiKey = key };
            await client.Models.Retrieve(row.Model);
        }
        catch (Exception ex)
        {
            return (false, Describe(ex), null);
        }

        row.ApiKeyProtected = ApiKeyProtector.Protect(key);
        row.KeyHint = ApiKeyProtector.Hint(key);
        row.LastError = null;
        await db.SaveChangesAsync();

        return (true, null, await GetStatusAsync());
    }

    public async Task<CoachStatusDto> DisconnectAsync()
    {
        var row = await GetRowAsync();
        row.ApiKeyProtected = null;
        row.KeyHint = null;
        row.LastError = null;
        await db.SaveChangesAsync();
        return await GetStatusAsync();
    }

    public async Task<(bool Ok, string? Error, CoachStatusDto? Status)> SetModelAsync(SetModelDto dto)
    {
        if (!AllowedModels.Contains(dto.Model)) return (false, "Unknown model.", null);

        var row = await GetRowAsync();
        row.Model = dto.Model;
        await db.SaveChangesAsync();
        return (true, null, await GetStatusAsync());
    }

    /// <summary>
    /// Returns the key to use for one grading call, or null when there is no coach configured or
    /// the daily cap is spent. Increments the counter, so a caller that fails still burns its slot
    /// rather than being able to loop for free.
    /// </summary>
    public async Task<(string? Key, string Model, string? Refusal)> TryBeginCallAsync()
    {
        var row = await GetRowAsync();

        var key = ApiKeyProtector.TryUnprotect(row.ApiKeyProtected);
        if (key is null)
        {
            // A stored-but-undecryptable key means the row moved machines or profiles. Clear it,
            // so the UI asks for the key again instead of failing forever on every answer.
            if (row.ApiKeyProtected is not null)
            {
                row.ApiKeyProtected = null;
                row.KeyHint = null;
                row.LastError = "Saved key could not be read on this Windows profile. Enter it again.";
                await db.SaveChangesAsync();
            }
            return (null, row.Model, null);
        }

        if (row.CallsDate != Today)
        {
            row.CallsDate = Today;
            row.CallsToday = 0;
        }
        if (row.CallsToday >= DailyLimit)
            return (null, row.Model, $"Daily limit of {DailyLimit} coach calls reached. Score this one yourself.");

        row.CallsToday++;
        row.LastCallAt = DateTime.Now;
        await db.SaveChangesAsync();

        return (key, row.Model, null);
    }

    public async Task RecordResultAsync(string? error)
    {
        var row = await GetRowAsync();
        row.LastError = error;
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Maps an SDK failure to a short fixed string. Deliberately does not use the exception
    /// message: Program.cs has no exception handler, so in a dev build anything that escapes is
    /// rendered in full on the developer error page.
    /// </summary>
    public static string Describe(Exception ex) => ex switch
    {
        AnthropicUnauthorizedException => "That API key was rejected.",
        AnthropicNotFoundException => "That model is not available on your account.",
        AnthropicRateLimitException => "Rate limited by Anthropic. Try again shortly.",
        Anthropic5xxException => "Anthropic had a problem at their end. Try again shortly.",
        TaskCanceledException or TimeoutException => "The coach took too long to answer.",
        HttpRequestException => "Could not reach Anthropic. Check your connection.",
        _ => "The coach could not grade this answer."
    };
}
