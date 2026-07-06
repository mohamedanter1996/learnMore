# Generates the LearnMore user manual PDF.
# Requires: pip install reportlab arabic-reshaper python-bidi
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image, KeepTogether
)
import arabic_reshaper
from bidi.algorithm import get_display

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "LearnMore-User-Manual.pdf")
ICON = os.path.join(ROOT, "electron", "assets", "icon.png")

# Arabic support: Segoe UI has the glyphs; reshaper+bidi handle joining and RTL order.
pdfmetrics.registerFont(TTFont("SegoeUI", r"C:\Windows\Fonts\segoeui.ttf"))
pdfmetrics.registerFont(TTFont("SegoeUI-Bold", r"C:\Windows\Fonts\segoeuib.ttf"))

def ar(text):
    """Shape + reorder an Arabic phrase for correct display, wrapped in the Arabic font."""
    shaped = get_display(arabic_reshaper.reshape(text))
    return f'<font face="SegoeUI">{shaped}</font>'

BG = HexColor("#0f172a")
PRIMARY = HexColor("#0284c7")
ACCENT = HexColor("#38bdf8")
TEXT = HexColor("#1e293b")
DIM = HexColor("#64748b")
SURFACE = HexColor("#f1f5f9")
BORDER = HexColor("#cbd5e1")
SUCCESS = HexColor("#059669")
WARNING = HexColor("#b45309")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle("CoverTitle", parent=styles["Title"], fontSize=34, leading=40,
                          textColor=white, alignment=TA_CENTER, spaceAfter=6))
styles.add(ParagraphStyle("CoverSub", parent=styles["Normal"], fontSize=14, leading=20,
                          textColor=HexColor("#bae6fd"), alignment=TA_CENTER))
styles.add(ParagraphStyle("H1x", parent=styles["Heading1"], fontSize=20, leading=26,
                          textColor=PRIMARY, spaceBefore=18, spaceAfter=8))
styles.add(ParagraphStyle("H2x", parent=styles["Heading2"], fontSize=14, leading=18,
                          textColor=TEXT, spaceBefore=14, spaceAfter=6))
styles.add(ParagraphStyle("Bodyx", parent=styles["Normal"], fontSize=10.5, leading=15.5,
                          textColor=TEXT, spaceAfter=7))
styles.add(ParagraphStyle("Bullet2", parent=styles["Bodyx"], leftIndent=14, bulletIndent=4))
styles.add(ParagraphStyle("Codex", parent=styles["Code"], fontSize=9, leading=13,
                          backColor=SURFACE, borderColor=BORDER, borderWidth=0.5,
                          borderPadding=6, spaceAfter=8, spaceBefore=2))
styles.add(ParagraphStyle("Tipx", parent=styles["Bodyx"], backColor=HexColor("#ecfdf5"),
                          borderColor=SUCCESS, borderWidth=0.8, borderPadding=7, spaceBefore=4))
styles.add(ParagraphStyle("Warnx", parent=styles["Bodyx"], backColor=HexColor("#fffbeb"),
                          borderColor=WARNING, borderWidth=0.8, borderPadding=7, spaceBefore=4))
styles.add(ParagraphStyle("TocRow", parent=styles["Bodyx"], fontSize=11.5, leading=22))

def H1(t): return Paragraph(t, styles["H1x"])
def H2(t): return Paragraph(t, styles["H2x"])
def P(t): return Paragraph(t, styles["Bodyx"])
def B(t): return Paragraph(t, styles["Bullet2"], bulletText="•")
def CODE(t): return Paragraph(t.replace("\n", "<br/>"), styles["Codex"])
def TIP(t): return Paragraph("✔ <b>Tip:</b> " + t, styles["Tipx"])
def WARN(t): return Paragraph("⚠ <b>Note:</b> " + t, styles["Warnx"])

def tbl(data, widths):
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("TEXTCOLOR", (0, 1), (-1, -1), TEXT),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, SURFACE]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t

def cell(text):
    return Paragraph(text, ParagraphStyle("cellp", parent=styles["Bodyx"], fontSize=9.5,
                                          leading=13, spaceAfter=0))

def on_cover(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(BG)
    canvas.rect(0, 0, w, h, stroke=0, fill=1)
    canvas.setFillColor(ACCENT)
    canvas.rect(0, h - 12, w, 12, stroke=0, fill=1)
    canvas.rect(0, 0, w, 12, stroke=0, fill=1)
    canvas.restoreState()

def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, h - 8, w, 8, stroke=0, fill=1)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(DIM)
    canvas.drawString(18 * mm, 10 * mm, "LearnMore — User Manual")
    canvas.drawRightString(w - 18 * mm, 10 * mm, f"Page {doc.page - 1}")
    canvas.restoreState()

story = []

# ---------------- Cover ----------------
story.append(Spacer(1, 60 * mm))
story.append(Image(ICON, width=34 * mm, height=34 * mm))
story.append(Spacer(1, 10 * mm))
story.append(Paragraph("LearnMore", styles["CoverTitle"]))
story.append(Paragraph("Daily Tech-Skill Trainer for Windows", styles["CoverSub"]))
story.append(Spacer(1, 6 * mm))
story.append(Paragraph("User Manual · Version 1.2", styles["CoverSub"]))
story.append(Spacer(1, 40 * mm))
story.append(Paragraph(
    "One new lesson, every single day.<br/>"
    "Data Structures &amp; Algorithms · Design Patterns · SQL Server Optimization · "
    "System Design · Frontend Engineering",
    styles["CoverSub"]))
story.append(PageBreak())

# ---------------- Contents ----------------
story.append(H1("Contents"))
for n, t in [
    (1, "What is LearnMore?"),
    (2, "Installation"),
    (3, "First Launch"),
    (4, "The Dashboard"),
    (5, "Today's Lesson — Your Daily Routine"),
    (6, "Arabic Explanations (" + ar("الشرح بالمصري") + ")"),
    (7, "Assessments, Roadmap &amp; Courses"),
    (8, "Browsing Topics"),
    (9, "Stats &amp; Streaks"),
    (10, "Reminders, Tray &amp; Auto-Start"),
    (11, "How the Daily Engine Picks Lessons"),
    (12, "Adding Your Own Lessons"),
    (13, "Automatic Updates"),
    (14, "Study Plans, Mind Map &amp; Tech News"),
    (15, "Troubleshooting"),
    (16, "FAQ"),
]:
    story.append(Paragraph(f"<b>{n}.</b> {t}", styles["TocRow"]))
story.append(PageBreak())

# ---------------- 1. What is ----------------
story.append(H1("1. What is LearnMore?"))
story.append(P(
    "LearnMore is a Windows desktop application built for one purpose: to make sure you learn "
    "<b>one new technical thing every day</b>. It assigns you a single daily lesson, reminds you "
    "with Windows notifications until you finish it, and tracks your streak so skipping a day hurts."))
story.append(P("The built-in library contains <b>~150 lessons</b> across five tracks:"))
story.append(tbl(
    [[cell("<b>Track</b>"), cell("<b>What you'll learn</b>")],
     [cell("\U0001f9ee Data Structures &amp; Algorithms"),
      cell("Big-O, arrays, hash tables, trees, graphs, sorting, dynamic programming — with C# examples")],
     [cell("\U0001f3d7 Design Patterns"),
      cell("SOLID, all GoF patterns, DI, CQRS, resilience patterns — with ASP.NET Core examples")],
     [cell("\U0001f5c4 SQL Server Optimization"),
      cell("Indexes, execution plans, statistics, parameter sniffing, locking — with runnable T-SQL")],
     [cell("\U0001f310 System Design"),
      cell("Caching, queues, sharding, CAP, sagas, real case studies (URL shortener, chat, feed)")],
     [cell("\U0001f3a8 Frontend Engineering"),
      cell("Angular signals, RxJS, change detection, CSS grid/flex, web vitals, security")]],
    [55 * mm, 115 * mm]))
story.append(Spacer(1, 4))
story.append(P("Each lesson includes a <b>reading</b> (5–20 minutes), a <b>practice task</b> "
               "you can apply to real code, <b>reference links</b>, and a <b>quiz</b>. "
               "The day only counts when you pass the quiz."))

# ---------------- 2. Installation ----------------
story.append(H1("2. Installation"))
story.append(H2("Requirements"))
story.append(B("Windows 10 or 11 (64-bit)"))
story.append(B("<b>SQL Server LocalDB</b> — usually already installed with Visual Studio or SQL "
               "Server Express. Verify with the command below; it should list <i>MSSQLLocalDB</i>."))
story.append(CODE("sqllocaldb info"))
story.append(P('If missing, install "LocalDB" from the SQL Server Express installer '
               "(Microsoft download, free)."))
story.append(H2("Install steps"))
story.append(B("Run <b>LearnMore Setup 1.0.0.exe</b>."))
story.append(B("Choose an installation folder (or accept the default)."))
story.append(B("Finish — LearnMore starts automatically and registers itself to start with Windows."))
story.append(WARN("On first run Windows SmartScreen may warn about an unknown publisher — the "
                  "installer is not code-signed. Click <b>More info → Run anyway</b>."))

# ---------------- 3. First launch ----------------
story.append(H1("3. First Launch"))
story.append(P("On first start the app:"))
story.append(B("Starts its local API in the background (nothing is sent to the internet — "
               "everything runs on your machine)."))
story.append(B("Creates a database named <b>LearnMore</b> on your LocalDB instance and fills it "
               "with all lessons. This takes a few seconds."))
story.append(B("Assigns <b>today's lesson</b> and opens the Dashboard."))
story.append(TIP("The very first lesson is always an easy one — the difficulty grows as you "
                 "progress through each track."))

# ---------------- 4. Dashboard ----------------
story.append(H1("4. The Dashboard"))
story.append(P("The Dashboard is your home screen. It shows:"))
story.append(B("<b>Today's lesson card</b> — the topic, title, estimated minutes and difficulty "
               "(★ = easy, ★★★ = hard). Click <b>Start learning →</b> to begin."))
story.append(B("<b>Current streak</b> \U0001f525 — consecutive days completed. Miss a day and it resets to zero."))
story.append(B("<b>Longest streak</b> \U0001f3c6 — your record. Beat it."))
story.append(B("<b>Last 30 days calendar</b> — green = completed, red = missed, yellow = today, still pending."))
story.append(P("The sidebar is always visible: <b>Dashboard</b>, <b>Today</b> (with a yellow dot when "
               "the lesson is pending, green when done), <b>Topics</b>, and <b>Stats</b>."))

# ---------------- 5. Today ----------------
story.append(H1("5. Today's Lesson — Your Daily Routine"))
story.append(P("This is the page you'll use every day. Work through it top to bottom:"))
story.append(H2("Step 1 — Read the lesson"))
story.append(P("The main card contains the lesson with code examples and tables. Reading time is "
               "shown in the header (typically 12–22 minutes)."))
story.append(H2("Step 2 — Do the practice task"))
story.append(P("Below the lesson is a \U0001f6e0 practice task — a small, concrete exercise, usually "
               "pointed at your own real projects. This is where the knowledge actually sticks. "
               "The app doesn't check it; it's on your honour."))
story.append(H2("Step 3 — Pass the quiz"))
story.append(B("Answer every question (the Submit button stays disabled until all are answered)."))
story.append(B("<b>All correct</b> → the day is complete \U0001f389 — your streak increases and the "
               "tray icon tooltip flips to “done for today”."))
story.append(B("<b>Wrong answers</b> → they are highlighted in red, the correct answer in green, and an "
               "explanation appears. Read it, then resubmit — you can retry as many times as you like."))
story.append(H2("Step 4 — Go deeper (optional)"))
story.append(P("The \U0001f517 links open the official docs or the best article on the subject in your browser."))
story.append(TIP("Completed lessons stay readable forever — revisit them any time from the Topics page, "
                 "with quiz answers revealed."))

# ---------------- 6. Arabic explanations ----------------
story.append(H1("6. Arabic Explanations (" + ar("الشرح بالمصري") + ")"))
story.append(P("Every lesson includes a condensed explanation written in <b>Egyptian colloquial Arabic</b> "
               "— the way developers actually explain things to each other. Technical terms (index, cache, "
               "closure, deadlock...) stay in English; the explanation around them is " + ar("مصري") + " ."))
story.append(H2("Using it"))
story.append(B("On any lesson page (Today, or a completed lesson), click the "
               "<b>\U0001f1ea\U0001f1ec " + ar("اشرح بالمصري") + "</b> button in the lesson header."))
story.append(B("The Arabic panel appears below the English lesson, right-to-left, with code snippets "
               "kept left-to-right."))
story.append(B("Click again (" + ar("إخفاء الشرح") + ") to hide it. Your choice is remembered — "
               "if you leave it on, every lesson opens with the Arabic explanation visible."))
story.append(H2("How to learn with it"))
story.append(P("Recommended flow: read the English lesson first (the terminology you'll use in interviews "
               "and documentation is English), then read the Arabic explanation to lock in the intuition. "
               "The quiz stays in English on purpose — that's the vocabulary being trained."))
story.append(TIP("Adding your own lessons? Put Arabic explanations in <font face='Courier' size='9'>"
                 "seed\\ar\\*.json</font> files matched by lesson title — see the README for the exact format."))

# ---------------- 7. Assessments ----------------
story.append(H1("7. Assessments, Roadmap &amp; Courses"))
story.append(H2("\U0001f393 Assessment — find your level"))
story.append(P("Each track has an interview-style assessment (~20 multiple-choice questions across "
               "Junior/Mid/Senior difficulty). Your level per track:"))
story.append(tbl(
    [[cell("<b>Level</b>"), cell("<b>Requirement</b>")],
     [cell("Junior"), cell("Junior-tier questions ≥ 70%")],
     [cell("Mid-Level"), cell("Junior achieved AND mid-tier ≥ 60%")],
     [cell("Senior"), cell("Mid achieved AND senior-tier ≥ 60%")]],
    [40 * mm, 130 * mm]))
story.append(Spacer(1, 4))
story.append(P("After submitting you get: your level, a per-tier score breakdown, every missed question "
               "with its explanation and a link to the lesson that teaches it, and <b>course "
               "recommendations</b> for reaching the next level (free, paid \U0001f4b0 and Arabic \U0001f1ea\U0001f1ec options). "
               "Retake assessments monthly to measure progress."))
story.append(H2("\U0001f5fa Roadmap — see the whole climb"))
story.append(B("Every track shown as a Junior → Mid → Senior ladder of lessons."))
story.append(B("✅ completed lessons, \U0001f4d6 today's lesson, ◻ upcoming."))
story.append(B("\U0001f4cd YOU ARE HERE marker placed from your latest assessment result."))
story.append(B("\U0001f3af weak-spot flags on lessons matching questions you missed — the app literally "
               "shows you what to study next."))
story.append(TIP("Flow that works: take the assessment → check the roadmap → let the daily lessons "
                 "close the gaps → retake in a month and watch the marker climb."))

# ---------------- 8. Topics ----------------
story.append(H1("8. Browsing Topics"))
story.append(P("The Topics page shows the five tracks with progress bars. Click one to see its full "
               "lesson list in learning order:"))
story.append(tbl(
    [[cell("<b>Icon</b>"), cell("<b>Meaning</b>")],
     [cell("✅"), cell("Completed — click to re-read it, including quiz answers and explanations")],
     [cell("\U0001f4d6"), cell("Today's lesson — click to jump to the Today page")],
     [cell("\U0001f512"), cell("Locked — will unlock when the daily engine assigns it on a future day")]],
    [25 * mm, 145 * mm]))
story.append(Spacer(1, 4))
story.append(P("Locking is deliberate: the app enforces <b>one lesson per day</b>. You cannot binge "
               "the whole track in a weekend and forget it by Monday — spaced daily learning is the "
               "entire point of LearnMore."))

# ---------------- 9. Stats ----------------
story.append(H1("9. Stats &amp; Streaks"))
story.append(B("<b>Current / longest streak</b> and <b>total lessons completed</b>."))
story.append(B("<b>Percentage of the whole bank</b> — ~150 lessons ≈ 5 months of daily learning."))
story.append(B("<b>Per-topic progress bars</b> — the engine rotates topics evenly, so these grow together."))
story.append(H2("Streak rules"))
story.append(B("Complete today's quiz → streak +1 (if yesterday was also completed)."))
story.append(B("Miss a day → streak resets to 1 on your next completed day."))
story.append(B("Longest streak is never lost — it's your all-time record."))

# ---------------- 10. Reminders ----------------
story.append(H1("10. Reminders, Tray &amp; Auto-Start"))
story.append(P("<b>New in v1.1 — motivation, not just nagging:</b> streak-milestone celebrations "
               "(3, 7, 14, 30, 60, 100+ days \U0001f525), a congratulation toast when you finish the day, "
               "near-finish nudges when a track has ≤3 lessons left, and rotating reminder messages."))
story.append(P("LearnMore is designed to be impossible to ignore:"))
story.append(B("<b>Starts with Windows</b>, minimized to the system tray."))
story.append(B("From <b>09:00</b> (default), if today's lesson is not done, a Windows toast notification "
               "appears — and repeats every <b>2 hours</b> until you finish."))
story.append(B("Clicking the notification opens the app directly on today's lesson."))
story.append(B("<b>Closing the window does not quit</b> — the app hides to the tray so reminders keep "
               "working. To really quit: right-click the tray icon → <b>Quit</b>."))
story.append(H2("Tray icon menu"))
story.append(tbl(
    [[cell("<b>Item</b>"), cell("<b>Action</b>")],
     [cell("Open LearnMore"), cell("Shows the main window")],
     [cell("Today's lesson"), cell("Opens the window directly on the Today page")],
     [cell("Quit"), cell("Fully exits the app (reminders stop until next login)")]],
    [45 * mm, 125 * mm]))
story.append(Spacer(1, 4))
story.append(P("Hover the tray icon to see the status: “today's lesson is waiting \U0001f4d6” "
               "or “done for today ✅”."))

# ---------------- 11. Engine ----------------
story.append(H1("11. How the Daily Engine Picks Lessons"))
story.append(B("<b>Topic rotation:</b> round-robin — the topic that was assigned longest ago goes next, "
               "so all five tracks advance evenly (roughly each topic every 5 days)."))
story.append(B("<b>Difficulty progression:</b> within a topic, all ★ lessons come before ★★, "
               "then ★★★ — foundations first."))
story.append(B("<b>One per day:</b> a new lesson is created the first time the app checks after midnight. "
               "Yesterday's unfinished lesson counts as missed."))
story.append(B("<b>After the bank is finished</b> (~5 months), lessons recycle oldest-first as review days."))

# ---------------- 12. Own content ----------------
story.append(H1("12. Adding Your Own Lessons"))
story.append(P("Lessons live as JSON files in the <b>seed</b> folder inside the installation directory "
               "(<i>resources\\seed</i>). Each file is one topic:"))
story.append(CODE(
    '{\n'
    '  "topic": "SQL Server Optimization",\n'
    '  "color": "#ef4444",\n'
    '  "icon": "\U0001f5c4",\n'
    '  "items": [\n'
    '    {\n'
    '      "title": "My New Lesson",\n'
    '      "difficulty": 2,\n'
    '      "estimatedMinutes": 15,\n'
    '      "bodyMarkdown": "# Heading\\n\\nLesson text with **markdown** and ```sql code```...",\n'
    '      "practiceTask": "Try it on your own database.",\n'
    '      "externalLinks": ["https://..."],\n'
    '      "quiz": [ { "question": "...?", "options": ["A","B","C","D"],\n'
    '                  "correctIndex": 0, "explanation": "..." } ]\n'
    '    }\n'
    '  ]\n'
    '}'))
story.append(B("Add new items to an existing file (existing topic) or create a new .json file (new topic)."))
story.append(B("Restart the app — the seeder adds anything with a <b>new title</b>; existing lessons are "
               "never modified or duplicated."))

# ---------------- 13. Auto-update ----------------
story.append(H1("13. Automatic Updates"))
story.append(P("LearnMore updates itself. On start (and every 4 hours) it checks "
               "<font face='Courier' size='9'>github.com/mohamedanter1996/learnMore</font> releases, "
               "downloads new versions in the background, and installs when you quit the app."))
story.append(B("A toast appears when an update is downloaded — keep working; it installs on quit."))
story.append(B("Or right-click the tray icon → <b>⬆️ Restart to update</b> to apply immediately."))
story.append(B("Your progress is always preserved: database migrations and new lessons apply "
               "automatically on the updated version's first launch."))

# ---------------- 14. v1.2 features ----------------
story.append(H1("14. Study Plans, Mind Map &amp; Tech News"))
story.append(H2("\U0001f9ed Study Plans (with calendar tracker)"))
story.append(P("Beyond the guided daily lessons, you can set your own learning goals over a time "
               "period and track them — perfect for prepping a course, a certification, or a new skill."))
story.append(B("Open <b>Study Plan</b> in the sidebar → <b>New plan</b>: give it a title and a "
               "start/end date."))
story.append(B("Inside the plan, add <b>goals</b> (free text — anything you want to learn) and check "
               "them off as you achieve them."))
story.append(B("Use the <b>calendar</b> to click each day you actually studied — the plan tracks your "
               "goal %, days studied, study-day streak, and days remaining."))
story.append(TIP("Combine it with the daily lessons: let the app pick your daily lesson, and use a plan "
                 "to drive a bigger goal like 'Finish the SQL optimization track by month-end'."))
story.append(H2("\U0001f9e0 Roadmap mind map"))
story.append(P("On the <b>Roadmap</b> page, use the <b>List / Mind map</b> toggle (top right). The mind "
               "map draws each track as a tree — the topic at the center, Junior/Mid/Senior tiers "
               "branching out, and every lesson as a dot: green = completed, blue = today, grey = "
               "upcoming, with a red ring on your assessment weak spots \U0001f3af. Click a dot to open "
               "that lesson. Your preferred view is remembered."))
story.append(H2("\U0001f4f0 What's New in Tech"))
story.append(P("The <b>What's New</b> page keeps you informed of developments in the tools you use — "
               ".NET, C#, Angular, TypeScript, SQL Server, EF Core, and the web platform. Each "
               "technology lists recent highlights and a 'learn next' pointer. The feed is refreshed "
               "with every app update."))
story.append(H2("\U0001f514 Notification settings"))
story.append(P("The <b>Settings</b> page (⚙️) lets you set your reminder time, how often reminders "
               "repeat (every 1–4 hours), and toggle notifications. You'll also get a morning kickoff "
               "and an evening streak-saver, with rotating bilingual (\U0001f1ea\U0001f1ec / English) "
               "encouragement so it never feels repetitive."))

# ---------------- 15. Troubleshooting ----------------
story.append(H1("15. Troubleshooting"))
story.append(tbl(
    [[cell("<b>Problem</b>"), cell("<b>Fix</b>")],
     [cell("“API failed to start. Check that SQL Server LocalDB is installed” on launch"),
      cell("Run <b>sqllocaldb info</b> in a terminal. If nothing is listed, install LocalDB "
           "(SQL Server Express installer). Then restart the app. You can also try "
           "<b>sqllocaldb start MSSQLLocalDB</b>.")],
     [cell("Window is blank / stuck loading"),
      cell("The API may still be starting (first run seeds the database). Wait ~15 seconds; "
           "if still blank, quit via tray and start again.")],
     [cell("No reminder notifications"),
      cell("Check Windows Settings → System → Notifications: notifications must be enabled for "
           "LearnMore, and Focus Assist / Do Not Disturb off. Also confirm the app is running in the tray.")],
     [cell("App doesn't start with Windows"),
      cell("Task Manager → Startup apps → enable <b>LearnMore</b>.")],
     [cell("Start over with a fresh database"),
      cell("Quit the app, run:<br/><font face='Courier' size='8'>sqlcmd -S \"(localdb)\\MSSQLLocalDB\" "
           "-Q \"DROP DATABASE LearnMore\"</font><br/>then start the app — it recreates and reseeds "
           "everything (progress and streaks are lost).")],
     [cell("Where is my data?"),
      cell("Everything is local: a SQL Server LocalDB database named <b>LearnMore</b> under your "
           "Windows user. Nothing is uploaded anywhere.")]],
    [55 * mm, 115 * mm]))

# ---------------- 16. FAQ ----------------
story.append(H1("16. FAQ"))
story.append(H2("Can I do more than one lesson per day?"))
story.append(P("No — by design. One focused lesson daily beats binge-reading. You can, however, "
               "re-read any completed lesson from Topics."))
story.append(H2("What happens if I miss a day?"))
story.append(P("The missed day shows red in the calendar and your streak resets. The lesson you missed "
               "isn't lost — it stays in the pool and will be assigned again on a future day."))
story.append(H2("Do wrong quiz answers hurt my streak?"))
story.append(P("No. Wrong answers show explanations and you can retry immediately — the goal is "
               "learning, not punishment. Only leaving the day unfinished hurts."))
story.append(H2("Can I change the reminder time?"))
story.append(P("The default is 09:00, repeating every 2 hours. These are stored in the database "
               "(Settings table) and exposed via the local API (<font face='Courier' size='9'>PUT "
               "http://localhost:5199/api/settings</font>). A settings screen is a planned improvement."))
story.append(H2("Does it need internet?"))
story.append(P("No. All lessons are stored locally. Internet is only needed if you click the external "
               "“Go deeper” links."))
story.append(Spacer(1, 10 * mm))
story.append(Paragraph("Happy learning — keep the streak alive! \U0001f525",
                       ParagraphStyle("closing", parent=styles["Bodyx"], fontSize=13,
                                      alignment=TA_CENTER, textColor=PRIMARY)))

doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=18 * mm, rightMargin=18 * mm,
                        topMargin=18 * mm, bottomMargin=18 * mm,
                        title="LearnMore User Manual", author="LearnMore")
doc.build(story, onFirstPage=on_cover, onLaterPages=on_page)
print("written:", OUT)
