using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LearnMore.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUdemySessionSuggestion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CompletedLectureIdsJson",
                table: "UdemyProgress",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "[]"); // rows carried over from v1.7 start as an empty lecture set

            migrationBuilder.AddColumn<bool>(
                name: "IsEstimated",
                table: "UdemyProgress",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "PendingMinutes",
                table: "UdemyProgress",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "PendingSince",
                table: "UdemyProgress",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "WatchedMinutesTotal",
                table: "UdemyProgress",
                type: "float",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<int>(
                name: "Source",
                table: "StudySessions",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompletedLectureIdsJson",
                table: "UdemyProgress");

            migrationBuilder.DropColumn(
                name: "IsEstimated",
                table: "UdemyProgress");

            migrationBuilder.DropColumn(
                name: "PendingMinutes",
                table: "UdemyProgress");

            migrationBuilder.DropColumn(
                name: "PendingSince",
                table: "UdemyProgress");

            migrationBuilder.DropColumn(
                name: "WatchedMinutesTotal",
                table: "UdemyProgress");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "StudySessions");
        }
    }
}
