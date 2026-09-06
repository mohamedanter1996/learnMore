using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LearnMore.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCoachSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CoachSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ApiKeyProtected = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    KeyHint = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Model = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    LastError = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    LastCallAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CallsToday = table.Column<int>(type: "int", nullable: false),
                    CallsDate = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoachSettings", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CoachSettings");
        }
    }
}
