using System.Text.Json;
using LearnMore.Api.Data;
using LearnMore.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LearnMore.Api.Services;

public record ScenarioListRowDto(
    int Id, string Slug, string Title, string Domain, int Difficulty, int EstimatedMinutes,
    int StageCount, bool HasActiveRun, int Runs, int? LastPercent, int? BestPercent,
    DateTime? LastRunAt);

public record ScenarioDetailDto(
    int Id, string Slug, string Title, string Domain, int Difficulty, int EstimatedMinutes,
    string ContextMarkdown, string StakeholdersMarkdown, string ConstraintsMarkdown,
    int StageCount, ScenarioRunDto? ActiveRun);

public record ScenarioStageDto(int Id, int Order, string? Label, string Prompt, string InputHint);

public record CoverageDto(
    int RubricPointId, string Text, string Tag, int Weight,
    string Verdict, string? LlmVerdict, string Evidence, bool QuoteUnverified);

public record FeedbackDto(List<string> Strengths, List<string> Gaps, string SeniorMove, string ArabicSummary);

public record ScenarioStageResultDto(
    int StageId, int Order, string? Label, string Prompt, string AnswerText, DateTime SubmittedAt,
    bool Graded, string? GradeError, string? ProbeQuestion, string? ProbeAnswerText,
    List<CoverageDto> Coverage, FeedbackDto? Feedback,
    string ModelAnswerMarkdown, string RevealMarkdown,
    double Score, int MaxScore, int Covered, int Points);

public record ScenarioRunDto(
    int Id, int ScenarioId, string Slug, string Title, string Status,
    DateTime StartedAt, DateTime? CompletedAt,
    int StageCount, ScenarioStageDto? CurrentStage, List<ScenarioStageResultDto> History,
    int Percent, int Covered, int Points, bool CanFinishEarly,
    List<ScenarioStageDto> SkippedStages);

public record WeaknessRowDto(string Tag, int Seen, int Covered, int Percent);

public record SubmitAnswerDto(int StageId, string Text);
public record ProbeReplyDto(int StageId, string Text);
public record VerdictItemDto(int RubricPointId, string Verdict);
public record SetVerdictsDto(int StageId, List<VerdictItemDto> Verdicts);

/// <summary>
/// Runs the scenario simulation and owns every number it produces.
///
/// Two rules hold this together. First, <b>the score is computed here and nowhere else</b> — the
/// coach reports rubric coverage only, and any number it emits is discarded. Second, there is
/// <b>no stored cursor and no stored total</b>: position is the lowest-Order stage without a
/// graded answer, and the score is a pure function of the coverage rows. Both are computed on
/// read, so a flipped verdict can never leave a stale total behind.
/// </summary>
public class ScenarioService(AppDbContext db, ScenarioGradingService grader)
{
    /// <summary>What a hit, a partial and a miss are worth. The only scoring constant.</summary>
    private static double Factor(CoverageVerdict v) => v switch
    {
        CoverageVerdict.Hit => 1.0,
        CoverageVerdict.Partial => 0.5,
        _ => 0.0
    };

    // ------------------------------------------------------------------ reads

    public async Task<List<ScenarioListRowDto>> GetListAsync()
    {
        var scenarios = await db.Scenarios
            .Include(s => s.Stages).ThenInclude(st => st.RubricPoints)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Id)
            .ToListAsync();

        var runs = await LoadRunsAsync(r => true);

        return scenarios.Select(s =>
        {
            var mine = runs.Where(r => r.ScenarioId == s.Id).ToList();
            var scored = mine
                .Where(r => r.Status != ScenarioRunStatus.InProgress)
                .Select(Percent)
                .Where(p => p.HasValue)
                .Select(p => p!.Value)
                .ToList();

            return new ScenarioListRowDto(
                s.Id, s.Slug, s.Title, s.Domain, s.Difficulty, s.EstimatedMinutes,
                s.Stages.Count,
                mine.Any(r => r.Status == ScenarioRunStatus.InProgress),
                mine.Count(r => r.Status != ScenarioRunStatus.InProgress),
                scored.Count == 0 ? null : scored.Last(),
                scored.Count == 0 ? null : scored.Max(),
                mine.Count == 0 ? null : mine.Max(r => r.StartedAt));
        }).ToList();
    }

    public async Task<ScenarioDetailDto?> GetDetailAsync(string slug)
    {
        var scenario = await db.Scenarios
            .Include(s => s.Stages)
            .FirstOrDefaultAsync(s => s.Slug == slug);
        if (scenario is null) return null;

        var active = (await LoadRunsAsync(r => r.ScenarioId == scenario.Id
            && r.Status == ScenarioRunStatus.InProgress)).FirstOrDefault();

        return new ScenarioDetailDto(
            scenario.Id, scenario.Slug, scenario.Title, scenario.Domain, scenario.Difficulty,
            scenario.EstimatedMinutes, scenario.ContextMarkdown, scenario.StakeholdersMarkdown,
            scenario.ConstraintsMarkdown, scenario.Stages.Count,
            active is null ? null : ToDto(active));
    }

    public async Task<ScenarioRunDto?> GetRunAsync(int runId)
    {
        var run = (await LoadRunsAsync(r => r.Id == runId)).FirstOrDefault();
        return run is null ? null : ToDto(run);
    }

    // ----------------------------------------------------------------- writes

    /// <summary>Resumes the run that is already in progress rather than forking a second one.
    /// The filtered unique index on (ScenarioId, Status) enforces this in the database too.</summary>
    public async Task<ScenarioRunDto?> StartAsync(string slug)
    {
        var scenario = await db.Scenarios.FirstOrDefaultAsync(s => s.Slug == slug);
        if (scenario is null) return null;

        var active = await db.ScenarioRuns.FirstOrDefaultAsync(r =>
            r.ScenarioId == scenario.Id && r.Status == ScenarioRunStatus.InProgress);

        if (active is null)
        {
            active = new ScenarioRun { ScenarioId = scenario.Id, StartedAt = DateTime.Now };
            db.ScenarioRuns.Add(active);
            await db.SaveChangesAsync();
        }

        return await GetRunAsync(active.Id);
    }

    /// <summary>
    /// Stores the answer, then grades it. The answer row is written and committed <b>before</b>
    /// the coach is called, so a timeout costs you a grade and never your typing.
    /// </summary>
    public async Task<(bool Ok, string? Error, ScenarioRunDto? Run)> SubmitAnswerAsync(
        int runId, SubmitAnswerDto dto)
    {
        var run = (await LoadRunsAsync(r => r.Id == runId)).FirstOrDefault();
        if (run is null) return (false, "Run not found.", null);
        if (run.Status != ScenarioRunStatus.InProgress) return (false, "This run is already finished.", null);

        var text = (dto.Text ?? "").Trim();
        if (text.Length < 10) return (false, "Write a bit more before submitting.", null);

        var stage = run.Scenario.Stages.FirstOrDefault(s => s.Id == dto.StageId);
        if (stage is null) return (false, "That stage is not part of this scenario.", null);

        var current = CurrentStage(run);
        if (current is null || current.Id != stage.Id)
            return (false, "That is not the stage you are on.", null);

        var answer = run.Answers.FirstOrDefault(a => a.StageId == stage.Id);
        if (answer is not null && answer.Coverage.Count > 0)
            return (false, "That stage is already graded.", null);

        if (answer is null)
        {
            answer = new ScenarioAnswer { RunId = run.Id, StageId = stage.Id };
            run.Answers.Add(answer);
        }

        answer.AnswerText = text;
        answer.SubmittedAt = DateTime.Now;
        answer.GradeError = null;
        answer.ProbeQuestion = null;
        answer.ProbeAnswerText = null;

        // Committed before the network call. This ordering is the whole point.
        await db.SaveChangesAsync();

        await GradeAsync(answer, stage);
        MaybeComplete(run);
        await db.SaveChangesAsync();

        return (true, null, await GetRunAsync(run.Id));
    }

    /// <summary>Retries grading an answer that failed, without retyping it.</summary>
    public async Task<(bool Ok, string? Error, ScenarioRunDto? Run)> RegradeAsync(int runId, int stageId)
    {
        var run = (await LoadRunsAsync(r => r.Id == runId)).FirstOrDefault();
        if (run is null) return (false, "Run not found.", null);

        var answer = run.Answers.FirstOrDefault(a => a.StageId == stageId);
        if (answer is null) return (false, "Nothing to grade yet.", null);
        if (answer.Coverage.Count > 0) return (false, "That stage is already graded.", null);

        var stage = run.Scenario.Stages.First(s => s.Id == stageId);
        await GradeAsync(answer, stage);
        MaybeComplete(run);
        await db.SaveChangesAsync();

        return (true, null, await GetRunAsync(run.Id));
    }

    /// <summary>
    /// Stores your reply to the coach's follow-up and re-grades the stage with both taken
    /// together. Costs one more call, and only once: the probe can be answered a single time,
    /// so a stage can never cost more than two.
    /// </summary>
    public async Task<(bool Ok, string? Error, ScenarioRunDto? Run)> SubmitProbeAsync(
        int runId, ProbeReplyDto dto)
    {
        var run = (await LoadRunsAsync(r => r.Id == runId)).FirstOrDefault();
        if (run is null) return (false, "Run not found.", null);

        var answer = run.Answers.FirstOrDefault(a => a.StageId == dto.StageId);
        if (answer?.ProbeQuestion is null) return (false, "There is no question to answer here.", null);
        if (!string.IsNullOrWhiteSpace(answer.ProbeAnswerText))
            return (false, "You have already answered that one.", null);

        var text = (dto.Text ?? "").Trim();
        if (text.Length < 5) return (false, "Write a bit more before replying.", null);

        // Saved before the re-grade, for the same reason the first answer is: a failed call must
        // never cost you what you typed.
        answer.ProbeAnswerText = text;
        await db.SaveChangesAsync();

        var stage = run.Scenario.Stages.First(s => s.Id == dto.StageId);
        await GradeAsync(answer, stage);
        MaybeComplete(run);
        await db.SaveChangesAsync();

        return (true, null, await GetRunAsync(run.Id));
    }

    /// <summary>
    /// Sets your own verdicts. This is both the no-key self-scoring path and the one-click
    /// disagree-with-the-coach path — one write, because <see cref="ScenarioCoverage"/> holds
    /// both verdicts and yours simply wins.
    /// </summary>
    public async Task<(bool Ok, string? Error, ScenarioRunDto? Run)> SetVerdictsAsync(
        int runId, SetVerdictsDto dto)
    {
        var run = (await LoadRunsAsync(r => r.Id == runId)).FirstOrDefault();
        if (run is null) return (false, "Run not found.", null);

        var answer = run.Answers.FirstOrDefault(a => a.StageId == dto.StageId);
        if (answer is null) return (false, "Answer that stage first.", null);

        var stage = run.Scenario.Stages.First(s => s.Id == dto.StageId);
        var valid = stage.RubricPoints.ToDictionary(p => p.Id);

        foreach (var item in dto.Verdicts)
        {
            if (!valid.ContainsKey(item.RubricPointId)) continue;
            if (!TryParseVerdict(item.Verdict, out var verdict)) continue;

            var row = answer.Coverage.FirstOrDefault(c => c.RubricPointId == item.RubricPointId);
            if (row is null)
            {
                row = new ScenarioCoverage { AnswerId = answer.Id, RubricPointId = item.RubricPointId };
                answer.Coverage.Add(row);
            }
            row.UserVerdict = verdict;
        }

        // Self-scoring a stage with no coach grade still has to fill in the untouched points,
        // otherwise "ungraded" and "scored every point a miss" look identical.
        foreach (var point in stage.RubricPoints)
        {
            if (answer.Coverage.Any(c => c.RubricPointId == point.Id)) continue;
            var row = new ScenarioCoverage
            {
                AnswerId = answer.Id,
                RubricPointId = point.Id,
                UserVerdict = CoverageVerdict.Miss
            };
            answer.Coverage.Add(row);
        }

        answer.GradeError = null;
        MaybeComplete(run);
        await db.SaveChangesAsync();
        return (true, null, await GetRunAsync(run.Id));
    }

    /// <summary>Ends the run with what you actually did. Available from stage 2 onward so a
    /// half-hour on a Tuesday night still pays off instead of being wasted.</summary>
    public async Task<(bool Ok, string? Error, ScenarioRunDto? Run)> FinishAsync(int runId)
    {
        var run = (await LoadRunsAsync(r => r.Id == runId)).FirstOrDefault();
        if (run is null) return (false, "Run not found.", null);
        if (run.Status != ScenarioRunStatus.InProgress) return (false, "This run is already finished.", null);
        if (!GradedAnswers(run).Any()) return (false, "Finish at least one stage first.", null);

        run.Status = ScenarioRunStatus.Completed;
        run.CompletedAt = DateTime.Now;
        await db.SaveChangesAsync();
        return (true, null, await GetRunAsync(run.Id));
    }

    public async Task<bool> AbandonAsync(int runId)
    {
        var run = await db.ScenarioRuns.FirstOrDefaultAsync(r => r.Id == runId);
        if (run is null || run.Status != ScenarioRunStatus.InProgress) return false;

        run.Status = ScenarioRunStatus.Abandoned;
        run.CompletedAt = DateTime.Now;
        await db.SaveChangesAsync();
        return true;
    }

    // -------------------------------------------------------------- weaknesses

    /// <summary>
    /// The point of the whole module: which habits you skip, across every scenario you have run.
    /// Abandoned runs count — you still answered those stages, and the signal is real.
    /// </summary>
    public async Task<List<WeaknessRowDto>> GetWeaknessesAsync()
    {
        var rows = await db.ScenarioCoverage
            .Include(c => c.RubricPoint)
            .ToListAsync();

        return rows
            .GroupBy(c => c.RubricPoint.Tag)
            .Where(g => !string.IsNullOrWhiteSpace(g.Key))
            .Select(g =>
            {
                var seen = g.Count();
                var covered = g.Count(c => Effective(c) == CoverageVerdict.Hit);
                return new WeaknessRowDto(g.Key, seen, covered,
                    seen == 0 ? 0 : (int)Math.Round(100.0 * covered / seen));
            })
            .OrderBy(r => r.Percent).ThenByDescending(r => r.Seen)
            .ToList();
    }

    // ----------------------------------------------------------------- helpers

    private async Task GradeAsync(ScenarioAnswer answer, ScenarioStage stage)
    {
        var result = await grader.GradeAsync(stage, answer);
        if (result is null) return; // no key configured: the self-score path takes over

        if (!result.Ok)
        {
            answer.GradeError = result.Error;
            return;
        }

        answer.GradeError = null;
        answer.Model = result.Model;
        answer.InputTokens = result.InputTokens;
        answer.OutputTokens = result.OutputTokens;
        answer.ProbeQuestion = result.ProbeQuestion;
        answer.FeedbackJson = result.FeedbackJson;

        foreach (var point in stage.RubricPoints)
        {
            var graded = result.Coverage.FirstOrDefault(c => c.RubricPointId == point.Id);
            var row = answer.Coverage.FirstOrDefault(c => c.RubricPointId == point.Id);
            if (row is null)
            {
                row = new ScenarioCoverage { AnswerId = answer.Id, RubricPointId = point.Id };
                answer.Coverage.Add(row);
            }
            // A rubric point the model did not report is a miss, not a gap in the record.
            row.LlmVerdict = graded?.Verdict ?? CoverageVerdict.Miss;
            row.Evidence = graded?.Evidence ?? "";
            row.QuoteUnverified = graded?.QuoteUnverified ?? false;
        }
    }

    /// <summary>Completes only when every stage has been answered <i>and</i> graded. Counting
    /// stages alone would leave runs stranded when one stage failed to grade.</summary>
    private static void MaybeComplete(ScenarioRun run)
    {
        if (run.Status != ScenarioRunStatus.InProgress) return;
        if (run.Scenario.Stages.Count == 0) return;

        var graded = GradedAnswers(run).Select(a => a.StageId).ToHashSet();
        if (run.Scenario.Stages.All(s => graded.Contains(s.Id)))
        {
            run.Status = ScenarioRunStatus.Completed;
            run.CompletedAt = DateTime.Now;
        }
    }

    private static IEnumerable<ScenarioAnswer> GradedAnswers(ScenarioRun run) =>
        run.Answers.Where(a => a.Coverage.Count > 0);

    /// <summary>Position is derived, never stored: the lowest-Order stage without a graded
    /// answer. Resume after a restart, a reload and the back button all fall out of this.</summary>
    private static ScenarioStage? CurrentStage(ScenarioRun run)
    {
        var graded = GradedAnswers(run).Select(a => a.StageId).ToHashSet();
        return run.Scenario.Stages.OrderBy(s => s.Order).FirstOrDefault(s => !graded.Contains(s.Id));
    }

    private static CoverageVerdict Effective(ScenarioCoverage c) =>
        c.UserVerdict ?? c.LlmVerdict ?? CoverageVerdict.Miss;

    private static bool TryParseVerdict(string? raw, out CoverageVerdict verdict) =>
        Enum.TryParse(raw, ignoreCase: true, out verdict);

    private static int? Percent(ScenarioRun run)
    {
        var answers = GradedAnswers(run).ToList();
        if (answers.Count == 0) return null;

        var max = answers.Sum(a => a.Coverage.Sum(c => c.RubricPoint.Weight));
        if (max == 0) return null;

        var score = answers.Sum(a => a.Coverage.Sum(c => c.RubricPoint.Weight * Factor(Effective(c))));
        return (int)Math.Round(100 * score / max);
    }

    private Task<List<ScenarioRun>> LoadRunsAsync(
        System.Linq.Expressions.Expression<Func<ScenarioRun, bool>> where) =>
        db.ScenarioRuns
            .Include(r => r.Scenario).ThenInclude(s => s.Stages).ThenInclude(st => st.RubricPoints)
            .Include(r => r.Answers).ThenInclude(a => a.Coverage).ThenInclude(c => c.RubricPoint)
            .Where(where)
            .OrderBy(r => r.StartedAt)
            .ToListAsync();

    // --------------------------------------------------------------- mapping

    private static ScenarioRunDto ToDto(ScenarioRun run)
    {
        var stages = run.Scenario.Stages.OrderBy(s => s.Order).ToList();
        var current = run.Status == ScenarioRunStatus.InProgress ? CurrentStage(run) : null;

        var history = run.Answers
            .Where(a => a.Coverage.Count > 0 || a.GradeError is not null || a.AnswerText.Length > 0)
            .Join(stages, a => a.StageId, s => s.Id, (a, s) => (Answer: a, Stage: s))
            .OrderBy(x => x.Stage.Order)
            .Select(x => ToResultDto(x.Answer, x.Stage, run.Status != ScenarioRunStatus.InProgress))
            .ToList();

        var answered = history.Where(h => h.Graded).ToList();
        var max = answered.Sum(h => h.MaxScore);
        var score = answered.Sum(h => h.Score);

        // Finished early: the stages you never reached, so the screen can still show the answers.
        var reached = run.Answers.Select(a => a.StageId).ToHashSet();
        var skipped = run.Status == ScenarioRunStatus.InProgress
            ? []
            : stages.Where(s => !reached.Contains(s.Id))
                .Select(s => new ScenarioStageDto(s.Id, s.Order, s.Label, s.Prompt, s.InputHint))
                .ToList();

        return new ScenarioRunDto(
            run.Id, run.ScenarioId, run.Scenario.Slug, run.Scenario.Title,
            run.Status.ToString().ToLowerInvariant(),
            run.StartedAt, run.CompletedAt, stages.Count,
            current is null ? null
                : new ScenarioStageDto(current.Id, current.Order, current.Label, current.Prompt, current.InputHint),
            history,
            max == 0 ? 0 : (int)Math.Round(100 * score / max),
            answered.Sum(h => h.Covered), answered.Sum(h => h.Points),
            run.Status == ScenarioRunStatus.InProgress && answered.Count > 0 && answered.Count < stages.Count,
            skipped);
    }

    private static ScenarioStageResultDto ToResultDto(ScenarioAnswer answer, ScenarioStage stage, bool runFinished)
    {
        var graded = answer.Coverage.Count > 0;

        var coverage = stage.RubricPoints.OrderBy(p => p.SortOrder)
            .Select(p =>
            {
                var row = answer.Coverage.FirstOrDefault(c => c.RubricPointId == p.Id);
                return new CoverageDto(
                    p.Id, p.Text, p.Tag, p.Weight,
                    row is null ? "" : Effective(row).ToString().ToLowerInvariant(),
                    row?.LlmVerdict?.ToString().ToLowerInvariant(),
                    row?.Evidence ?? "",
                    row?.QuoteUnverified ?? false);
            })
            .ToList();

        FeedbackDto? feedback = null;
        if (!string.IsNullOrWhiteSpace(answer.FeedbackJson))
        {
            try { feedback = JsonSerializer.Deserialize<FeedbackDto>(answer.FeedbackJson); }
            catch (JsonException) { feedback = null; }
        }

        var score = answer.Coverage.Sum(c => c.RubricPoint.Weight * Factor(Effective(c)));
        var max = answer.Coverage.Sum(c => c.RubricPoint.Weight);

        return new ScenarioStageResultDto(
            stage.Id, stage.Order, stage.Label, stage.Prompt,
            answer.AnswerText, answer.SubmittedAt,
            graded, answer.GradeError, answer.ProbeQuestion, answer.ProbeAnswerText,
            coverage, feedback,
            // The model answer and the reveal are the reward for having answered. Never before.
            graded || runFinished ? stage.ModelAnswerMarkdown : "",
            graded || runFinished ? stage.RevealMarkdown : "",
            Math.Round(score, 1), max,
            answer.Coverage.Count(c => Effective(c) == CoverageVerdict.Hit),
            answer.Coverage.Count);
    }
}
