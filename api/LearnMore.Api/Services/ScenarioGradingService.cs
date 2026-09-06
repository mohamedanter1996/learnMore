using System.Text;
using System.Text.Json;
using Anthropic;
using Anthropic.Models.Messages;
using LearnMore.Api.Models;

namespace LearnMore.Api.Services;

public record GradedCoverage(int RubricPointId, CoverageVerdict Verdict, string Evidence, bool QuoteUnverified);

public record GradingResult(
    bool Ok, string? Error, string? Model, int InputTokens, int OutputTokens,
    string? ProbeQuestion, string? FeedbackJson, List<GradedCoverage> Coverage);

/// <summary>
/// Grades a free-text answer with Claude, using the key the user supplied.
///
/// Returning <c>null</c> means "no coach configured" — not an error. The scenario module is fully
/// usable without a key: the answer is stored ungraded and the self-scoring path takes over.
/// That is a rule, not a fallback.
///
/// Three things keep the grade honest. The model reports <b>coverage only</b> and is told its
/// numbers are discarded — the score is arithmetic done in <see cref="ScenarioService"/>. It never
/// sees the model answer, so it judges substance instead of matching phrasing. And every "hit"
/// must come with a verbatim quote, which is checked here against the answer text; a hit that
/// cannot be quoted is marked down to partial. A grader that must quote you cannot reward
/// hand-waving.
/// </summary>
public class ScenarioGradingService(CoachService coach)
{
    /// <summary>Byte-identical on every call in the app, so it is the cacheable prefix. Anything
    /// that varies per scenario or per stage belongs in the user message, after this.</summary>
    private const string GraderContract = """
        You grade engineering judgment, not writing. You are a staff engineer reviewing how a
        mid-to-senior .NET/Angular/SQL Server engineer reasoned about a real business situation.

        You will be given: a scenario, one stage prompt from that scenario, a numbered list of
        rubric points, and the engineer's free-text answer. Your only job is to report, for each
        rubric point, whether the answer covers it — and to quote the words that cover it.

        VERDICTS
        - "hit"     - the answer makes this point explicitly, or states something that could only
                      be true if the engineer had this point in mind. You can quote the words.
        - "partial" - the answer gestures at the point without committing: names the concern but
                      not the consequence, proposes the action but not the trigger, or mentions it
                      only in passing.
        - "miss"    - the point is absent, or the answer contradicts it.

        CALIBRATION - do not be generous
        A point is covered when the engineer said it, not when the topic came up.
        These are NOT hits:
        - Naming a technology without saying what it buys or costs here ("we would add Redis").
        - Correct-sounding vocabulary with no decision attached ("we should consider scalability").
        - Listing options without choosing, when the rubric point asks for a choice.
        - A plan whose first step is to build, when the rubric point asks what to find out first.
        - Agreeing with the stakeholder without saying what that agreement costs.
        If you cannot quote the words that cover the point, it is not a hit.

        CALIBRATION - do not be a pedant
        You are grading judgment, not vocabulary or completeness. These ARE hits:
        - The right idea in plain or informal language, or in mixed Arabic/English.
        - The right idea under a different name than you would use, including a local one.
        - A correct decision with a short justification. Depth beyond that earns nothing extra.
        - An approach different from yours, if it is sound under these constraints.
        Never deduct for spelling, grammar, structure, brevity, or missing diagrams. Never invent
        rubric points. Never reward length.

        OUTPUT
        One entry per rubric point, in the order given, using the exact ids provided. "evidence" is
        a verbatim quote from the answer - copy the characters exactly; do not paraphrase, correct,
        or trim to a fragment that changes the meaning. Use "" for a miss.

        Never output a score, a number, a grade, a percentage, or a level. Scoring is not your job
        and any number you produce will be discarded.

        "strengths" and "gaps": at most 3 short items each, addressed to the engineer as "you".
        "seniorMove": one sentence - the single thing a more senior engineer would have done here
        that this answer did not. "probeQuestion": one short follow-up that attacks the weakest
        part of the answer, in the voice of someone in the room. A question, never advice, and
        never one the answer already answers.

        "arabicSummary": two or three sentences of Egyptian Arabic (مصري), written to the engineer
        directly, saying what they got right and what they missed. Plain spoken Egyptian, not
        formal fus-ha. Technical terms stay in English.
        """;

    public async Task<GradingResult?> GradeAsync(ScenarioStage stage, ScenarioAnswer answer)
    {
        var (key, model, refusal) = await coach.TryBeginCallAsync();
        if (refusal is not null) return Failed(refusal);
        if (key is null) return null; // no coach configured — self-scoring takes over

        try
        {
            var client = new AnthropicClient { ApiKey = key };

            var response = await client.Messages.Create(new MessageCreateParams
            {
                Model = model,
                MaxTokens = 1500,
                OutputConfig = new OutputConfig
                {
                    Effort = Effort.Medium,
                    Format = new JsonOutputFormat { Schema = Schema() }
                },
                System = new List<TextBlockParam>
                {
                    // 1h TTL: a run spans 20-40 minutes, so the 5-minute default would miss
                    // between every single stage.
                    new() { Text = GraderContract, CacheControl = new CacheControlEphemeral { Ttl = Ttl.Ttl1h } }
                },
                Messages = [new() { Role = Role.User, Content = BuildPrompt(stage, answer) }]
            });

            if (response.StopReason == "max_tokens")
                return Failed("The coach ran out of room mid-answer. Try again.");

            var text = response.Content
                .Select(b => b.Value).OfType<TextBlock>()
                .Select(t => t.Text)
                .FirstOrDefault();

            if (string.IsNullOrWhiteSpace(text))
                return Failed("The coach returned nothing.");

            var parsed = JsonSerializer.Deserialize<CoachReply>(text, JsonOpts);
            if (parsed is null) return Failed("The coach returned something unreadable.");

            await coach.RecordResultAsync(null);

            return new GradingResult(
                true, null, model,
                (int)(response.Usage?.InputTokens ?? 0),
                (int)(response.Usage?.OutputTokens ?? 0),
                Clean(parsed.ProbeQuestion),
                JsonSerializer.Serialize(new
                {
                    strengths = Trim(parsed.Strengths),
                    gaps = Trim(parsed.Gaps),
                    seniorMove = parsed.SeniorMove ?? "",
                    arabicSummary = parsed.ArabicSummary ?? ""
                }),
                Reconcile(stage, answer, parsed));
        }
        catch (Exception ex)
        {
            var message = CoachService.Describe(ex);
            await coach.RecordResultAsync(message);
            return Failed(message);
        }
    }

    // ------------------------------------------------------------------ prompt

    private static string BuildPrompt(ScenarioStage stage, ScenarioAnswer answer)
    {
        var sb = new StringBuilder();
        var scenario = stage.Scenario;

        sb.AppendLine($"SCENARIO: {scenario.Title}").AppendLine();
        sb.AppendLine(scenario.ContextMarkdown).AppendLine();
        sb.AppendLine("WHO IS INVOLVED").AppendLine(scenario.StakeholdersMarkdown).AppendLine();
        sb.AppendLine("CONSTRAINTS").AppendLine(scenario.ConstraintsMarkdown).AppendLine();
        sb.AppendLine($"STAGE {stage.Order}: {stage.Label}").AppendLine(stage.Prompt).AppendLine();

        // Rubric point text and id only. No weights: the model must not be able to reason about
        // a score it is forbidden to produce.
        sb.AppendLine("RUBRIC POINTS");
        foreach (var p in stage.RubricPoints.OrderBy(p => p.SortOrder))
            sb.AppendLine($"[{p.Id}] {p.Text}");
        sb.AppendLine();

        sb.AppendLine("THE ENGINEER'S ANSWER").AppendLine("<<<").AppendLine(answer.AnswerText).AppendLine(">>>");

        // Present only on a re-grade, after they pushed back on the probe.
        if (!string.IsNullOrWhiteSpace(answer.ProbeQuestion) &&
            !string.IsNullOrWhiteSpace(answer.ProbeAnswerText))
        {
            sb.AppendLine();
            sb.AppendLine("YOU THEN ASKED THEM").AppendLine(answer.ProbeQuestion);
            sb.AppendLine("AND THEY REPLIED").AppendLine("<<<").AppendLine(answer.ProbeAnswerText).AppendLine(">>>");
            sb.AppendLine("Grade the answer and the reply together. Quote from either.");
        }

        return sb.ToString();
    }

    private static Dictionary<string, JsonElement> Schema() => new()
    {
        ["type"] = JsonSerializer.SerializeToElement("object"),
        ["additionalProperties"] = JsonSerializer.SerializeToElement(false),
        ["required"] = JsonSerializer.SerializeToElement(
            new[] { "coverage", "strengths", "gaps", "seniorMove", "arabicSummary", "probeQuestion" }),
        ["properties"] = JsonSerializer.SerializeToElement(new
        {
            coverage = new
            {
                type = "array",
                items = new
                {
                    type = "object",
                    additionalProperties = false,
                    required = new[] { "id", "verdict", "evidence" },
                    properties = new
                    {
                        id = new { type = "integer" },
                        verdict = new { type = "string", @enum = new[] { "hit", "partial", "miss" } },
                        evidence = new { type = "string" }
                    }
                }
            },
            strengths = new { type = "array", items = new { type = "string" } },
            gaps = new { type = "array", items = new { type = "string" } },
            seniorMove = new { type = "string" },
            arabicSummary = new { type = "string" },
            probeQuestion = new { type = "string" }
        })
    };

    // ------------------------------------------------------------- reconciling

    /// <summary>
    /// Walks <b>our</b> rubric points, not the model's list: a point the model forgot is a miss,
    /// and an id it invented is dropped. The shape of the score is never the model's to decide.
    /// </summary>
    private static List<GradedCoverage> Reconcile(ScenarioStage stage, ScenarioAnswer answer, CoachReply reply)
    {
        var haystack = Normalize(answer.AnswerText + " " + (answer.ProbeAnswerText ?? ""));
        var result = new List<GradedCoverage>();

        foreach (var point in stage.RubricPoints.OrderBy(p => p.SortOrder))
        {
            var entry = reply.Coverage?.FirstOrDefault(c => c.Id == point.Id);
            if (entry is null)
            {
                result.Add(new GradedCoverage(point.Id, CoverageVerdict.Miss, "", false));
                continue;
            }

            var verdict = entry.Verdict?.ToLowerInvariant() switch
            {
                "hit" => CoverageVerdict.Hit,
                "partial" => CoverageVerdict.Partial,
                _ => CoverageVerdict.Miss
            };

            var evidence = (entry.Evidence ?? "").Trim();
            var unverified = false;

            // A hit has to be quotable. If the quote is not actually in what they wrote, the
            // model is rewarding something that is not there, so mark it down.
            if (verdict == CoverageVerdict.Hit)
            {
                var quote = Normalize(evidence);
                if (quote.Length < 8 || !haystack.Contains(quote))
                {
                    verdict = CoverageVerdict.Partial;
                    unverified = true;
                }
            }

            result.Add(new GradedCoverage(point.Id, verdict, evidence, unverified));
        }

        return result;
    }

    /// <summary>Whitespace- and case-insensitive, so a reflowed or re-cased quote still matches.
    /// Anything looser would defeat the point of requiring a quote at all.</summary>
    private static string Normalize(string s) =>
        string.Join(' ', s.ToLowerInvariant().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    // ------------------------------------------------------------------ plumbing

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    private static GradingResult Failed(string error) =>
        new(false, error, null, 0, 0, null, null, []);

    private static string? Clean(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static List<string> Trim(List<string>? items) =>
        (items ?? []).Where(s => !string.IsNullOrWhiteSpace(s)).Take(3).ToList();

    private sealed class CoachReply
    {
        public List<CoachCoverage>? Coverage { get; set; }
        public List<string>? Strengths { get; set; }
        public List<string>? Gaps { get; set; }
        public string? SeniorMove { get; set; }
        public string? ArabicSummary { get; set; }
        public string? ProbeQuestion { get; set; }
    }

    private sealed class CoachCoverage
    {
        public int Id { get; set; }
        public string? Verdict { get; set; }
        public string? Evidence { get; set; }
    }
}
