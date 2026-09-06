using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LearnMore.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddScenarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Scenarios",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Slug = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Domain = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Difficulty = table.Column<int>(type: "int", nullable: false),
                    EstimatedMinutes = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    ContextMarkdown = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    StakeholdersMarkdown = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ConstraintsMarkdown = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Scenarios", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ScenarioRuns",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScenarioId = table.Column<int>(type: "int", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScenarioRuns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScenarioRuns_Scenarios_ScenarioId",
                        column: x => x.ScenarioId,
                        principalTable: "Scenarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ScenarioStages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScenarioId = table.Column<int>(type: "int", nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Prompt = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    InputHint = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ModelAnswerMarkdown = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    RevealMarkdown = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScenarioStages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScenarioStages_Scenarios_ScenarioId",
                        column: x => x.ScenarioId,
                        principalTable: "Scenarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ScenarioAnswers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RunId = table.Column<int>(type: "int", nullable: false),
                    StageId = table.Column<int>(type: "int", nullable: false),
                    AnswerText = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FeedbackJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ProbeQuestion = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ProbeAnswerText = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    GradeError = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Model = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    InputTokens = table.Column<int>(type: "int", nullable: false),
                    OutputTokens = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScenarioAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScenarioAnswers_ScenarioRuns_RunId",
                        column: x => x.RunId,
                        principalTable: "ScenarioRuns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ScenarioAnswers_ScenarioStages_StageId",
                        column: x => x.StageId,
                        principalTable: "ScenarioStages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScenarioRubricPoints",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StageId = table.Column<int>(type: "int", nullable: false),
                    Text = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Weight = table.Column<int>(type: "int", nullable: false),
                    Tag = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScenarioRubricPoints", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScenarioRubricPoints_ScenarioStages_StageId",
                        column: x => x.StageId,
                        principalTable: "ScenarioStages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ScenarioCoverage",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AnswerId = table.Column<int>(type: "int", nullable: false),
                    RubricPointId = table.Column<int>(type: "int", nullable: false),
                    LlmVerdict = table.Column<int>(type: "int", nullable: true),
                    UserVerdict = table.Column<int>(type: "int", nullable: true),
                    Evidence = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    QuoteUnverified = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScenarioCoverage", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScenarioCoverage_ScenarioAnswers_AnswerId",
                        column: x => x.AnswerId,
                        principalTable: "ScenarioAnswers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ScenarioCoverage_ScenarioRubricPoints_RubricPointId",
                        column: x => x.RubricPointId,
                        principalTable: "ScenarioRubricPoints",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScenarioAnswers_RunId_StageId",
                table: "ScenarioAnswers",
                columns: new[] { "RunId", "StageId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScenarioAnswers_StageId",
                table: "ScenarioAnswers",
                column: "StageId");

            migrationBuilder.CreateIndex(
                name: "IX_ScenarioCoverage_AnswerId_RubricPointId",
                table: "ScenarioCoverage",
                columns: new[] { "AnswerId", "RubricPointId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScenarioCoverage_RubricPointId",
                table: "ScenarioCoverage",
                column: "RubricPointId");

            migrationBuilder.CreateIndex(
                name: "IX_ScenarioRubricPoints_StageId",
                table: "ScenarioRubricPoints",
                column: "StageId");

            migrationBuilder.CreateIndex(
                name: "IX_ScenarioRubricPoints_Tag",
                table: "ScenarioRubricPoints",
                column: "Tag");

            migrationBuilder.CreateIndex(
                name: "IX_ScenarioRuns_ScenarioId_Status",
                table: "ScenarioRuns",
                columns: new[] { "ScenarioId", "Status" },
                unique: true,
                filter: "[Status] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_Scenarios_Slug",
                table: "Scenarios",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScenarioStages_ScenarioId_Order",
                table: "ScenarioStages",
                columns: new[] { "ScenarioId", "Order" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScenarioCoverage");

            migrationBuilder.DropTable(
                name: "ScenarioAnswers");

            migrationBuilder.DropTable(
                name: "ScenarioRubricPoints");

            migrationBuilder.DropTable(
                name: "ScenarioRuns");

            migrationBuilder.DropTable(
                name: "ScenarioStages");

            migrationBuilder.DropTable(
                name: "Scenarios");
        }
    }
}
