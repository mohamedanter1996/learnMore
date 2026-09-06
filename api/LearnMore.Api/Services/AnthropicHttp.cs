using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace LearnMore.Api.Services;

/// <summary>
/// A hand-rolled client for the two Anthropic endpoints this app uses.
///
/// The official <c>Anthropic</c> NuGet package would be the obvious choice, and it was used
/// first — but it depends on <c>System.Text.Json 10.x</c> and <c>Microsoft.Extensions.AI</c>,
/// which cannot be satisfied by a <b>self-contained net8.0</b> publish: the runtime pack wins
/// conflict resolution and ships 8.0.x, so the packaged app compiled against 10.0.0.0 refs and
/// died on startup with a <c>FileNotFoundException</c>. `dotnet run` hid it, because the .NET 10
/// SDK on the dev machine satisfies the reference.
///
/// Two endpoints and one JSON shape is a small enough surface to own directly. If this app is
/// ever retargeted to net10, switching back to the SDK is the better answer.
/// </summary>
public class AnthropicHttp(IHttpClientFactory factory)
{
    private const string Base = "https://api.anthropic.com/v1";
    private const string ApiVersion = "2023-06-01";

    /// <summary>The wire is snake_case (`stop_reason`, `input_tokens`), which case-insensitive
    /// matching alone does not bridge — it has to be the naming policy.</summary>
    private static readonly JsonSerializerOptions Wire = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    private HttpClient Client(string apiKey)
    {
        var http = factory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(90); // one grade, not a conversation
        http.DefaultRequestHeaders.Add("x-api-key", apiKey);
        http.DefaultRequestHeaders.Add("anthropic-version", ApiVersion);
        http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return http;
    }

    /// <summary>Cheap key check: the Models endpoint 401s on a bad key and costs nothing.</summary>
    public async Task<(bool Ok, string? Error)> ValidateKeyAsync(string apiKey, string model)
    {
        try
        {
            using var http = Client(apiKey);
            using var response = await http.GetAsync($"{Base}/models/{model}");
            return response.IsSuccessStatusCode ? (true, null) : (false, Describe(response.StatusCode));
        }
        catch (Exception ex)
        {
            return (false, DescribeException(ex));
        }
    }

    /// <summary>Posts one Messages request. Returns the first text block plus token usage.</summary>
    public async Task<(bool Ok, string? Error, string? Text, int InputTokens, int OutputTokens)>
        CreateMessageAsync(string apiKey, object body)
    {
        try
        {
            using var http = Client(apiKey);
            using var content = new StringContent(
                JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            using var response = await http.PostAsync($"{Base}/messages", content);

            var raw = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
                return (false, Describe(response.StatusCode), null, 0, 0);

            var parsed = JsonSerializer.Deserialize<MessageResponse>(raw, Wire);
            if (parsed is null) return (false, "The coach returned something unreadable.", null, 0, 0);

            if (parsed.StopReason == "max_tokens")
                return (false, "The coach ran out of room mid-answer. Try again.", null, 0, 0);

            var text = parsed.Content?.FirstOrDefault(b => b.Type == "text")?.Text;
            if (string.IsNullOrWhiteSpace(text))
                return (false, "The coach returned nothing.", null, 0, 0);

            return (true, null, text, parsed.Usage?.InputTokens ?? 0, parsed.Usage?.OutputTokens ?? 0);
        }
        catch (Exception ex)
        {
            return (false, DescribeException(ex), null, 0, 0);
        }
    }

    /// <summary>Short fixed strings only. The response body is never surfaced — it can carry the
    /// request back, and Program.cs has no exception handler to catch a leak in a dev build.</summary>
    private static string Describe(HttpStatusCode status) => status switch
    {
        HttpStatusCode.Unauthorized => "That API key was rejected.",
        HttpStatusCode.Forbidden => "That key is not allowed to use this model.",
        HttpStatusCode.NotFound => "That model is not available on your account.",
        HttpStatusCode.TooManyRequests => "Rate limited by Anthropic. Try again shortly.",
        HttpStatusCode.RequestEntityTooLarge => "That answer was too long to grade.",
        _ when (int)status >= 500 => "Anthropic had a problem at their end. Try again shortly.",
        _ => "The coach could not grade this answer."
    };

    public static string DescribeException(Exception ex) => ex switch
    {
        TaskCanceledException or TimeoutException => "The coach took too long to answer.",
        HttpRequestException => "Could not reach Anthropic. Check your connection.",
        JsonException => "The coach returned something unreadable.",
        _ => "The coach could not grade this answer."
    };

    private sealed class MessageResponse
    {
        public List<ContentBlock>? Content { get; set; }
        public string? StopReason { get; set; }
        public UsageInfo? Usage { get; set; }
    }

    private sealed class ContentBlock
    {
        public string? Type { get; set; }
        public string? Text { get; set; }
    }

    private sealed class UsageInfo
    {
        public int InputTokens { get; set; }
        public int OutputTokens { get; set; }
    }
}
