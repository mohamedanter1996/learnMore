using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LearnMore.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLessonCarryOver : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "CarriedFromDate",
                table: "DailyAssignments",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CarriedFromDate",
                table: "DailyAssignments");
        }
    }
}
