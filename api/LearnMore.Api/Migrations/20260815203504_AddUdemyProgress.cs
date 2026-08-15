using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LearnMore.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUdemyProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UdemyAccount",
                table: "AppSettings",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "UdemyConnected",
                table: "AppSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "UdemyLastError",
                table: "AppSettings",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UdemyLastSyncAt",
                table: "AppSettings",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "UdemyProgress",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CourseId = table.Column<int>(type: "int", nullable: false),
                    UdemyCourseId = table.Column<long>(type: "bigint", nullable: false),
                    CompletionRatio = table.Column<double>(type: "float", nullable: false),
                    LectureCount = table.Column<int>(type: "int", nullable: true),
                    LastAccessed = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SyncedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UdemyProgress", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UdemyProgress_PlanCourses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "PlanCourses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UdemyProgress_CourseId",
                table: "UdemyProgress",
                column: "CourseId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UdemyProgress");

            migrationBuilder.DropColumn(
                name: "UdemyAccount",
                table: "AppSettings");

            migrationBuilder.DropColumn(
                name: "UdemyConnected",
                table: "AppSettings");

            migrationBuilder.DropColumn(
                name: "UdemyLastError",
                table: "AppSettings");

            migrationBuilder.DropColumn(
                name: "UdemyLastSyncAt",
                table: "AppSettings");
        }
    }
}
