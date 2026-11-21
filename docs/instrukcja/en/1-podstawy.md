# Part I. Basics {ikona=ksiazka}

What Makietka is and how to work with projects.

# 1. Makietka at a glance

## 1.1 What you can do in Makietka

Makietka is an editor for print publications: books, calendars, planners, notebooks, invitations, labels —
page by page, like on a layout mock-up. At the end you get a PDF file ready for the print shop. It has what
a multi-page publication needs:

- **sections** with different formats — e.g. a cover with a spine calculated from the page count and paper (→ 10.6) and the body (→ 10.4),
- **spreads** with mirrored margins, like in a book (→ 10.5),
- **masters** — backgrounds, footers and page numbers drawn once for many pages (→ 11),
- **text styles** — one look for all headings or captions (→ 5.4),
- **a print-ready file** with bleed, crop marks and embedded fonts, also PDF/X-4 in CMYK (→ 21).

Makietka's strong point is **data**. You can repeat a page for every row of a table and insert
the values from that row into it: that's how you make a 365-day calendar, a planner for the whole year or a hundred
personalised invitations from one design (→ 14–17).

![Your projects](projekty.png)

## 1.2 How a project is built

One **project** is one publication. A project consists of:

| Part | What it is |
|---|---|
| **Sections** | Parts of the publication with their own format, margins and numbering, e.g. “Cover” and “Body”. |
| **Pages** | The pages of each section, in print order. Elements sit on the pages. |
| **Elements** | Texts, shapes, lines, images, tables and groups. |
| **Masters** | Elements shared by many pages — they lie under the page content or above it. |
| **Styles** | Saved text looks. |
| **Data tables** | Sheets with data for fields in text and for repeating pages. |
| **Images** | All the project's photos and graphics, in one window. |

The project saves itself, to your account (→ 2.4).

# 2. Projects

A project is one publication: here you create, open, copy and save projects.

## 2.1 Project list

Clicking a card opens the project in the editor — on the page you last edited on this device.
When you don't have any projects yet, the list offers [Create project], [From a template] (→ 10.10)
and [Import from file].

- The **cloud** next to the name tells you whether the changes are in your account: with a tick — saved, with a clock —
  waiting to be sent, crossed out — no internet (the changes are on the device and will be sent automatically).
- The **Shared** badge — the project has a preview link (→ 23). Clicking the badge opens
  the link window.
- Projects shared with you by others have a badge with the owner's name and the note
  “Can edit” or “Can view”. The [All], [Mine] and [Shared with me] filters
  appear when you have such projects.
- [Invitations] with a number — invitations to other people's projects waiting for your answer (→ 24.3).

![Project list](projekty.png)

## 2.2 New project

[New project] asks for a name, a page format (A4, A5, A6, B5, square or **Custom** in mm), orientation
and:

| Field | What it sets |
|---|---|
| **Bleed** | A strip beyond the page edge that the print shop trims off — usually 3 mm (→ 12.1). |
| **Margins** | The safe area for texts, in mm. |
| **Page layout** | **Single pages** or **Spreads (left + right)**, like in a book. |

You can change all of this later in the section settings (→ 10.4).

**Start from**: **Blank page** or **Template**. **Template** shows, right in this
window, templates of **whole projects** — sets of sections with settings, ready for print and for the 3D mock-up:

| Template | Sections |
|---|---|
| **Hardcover book** | hard cover, front endpaper, book block, back endpaper |
| **Hardcover book with dust jacket** | as above plus a dust jacket with flaps |
| **Paperback book** | soft glued cover, book block |
| **Saddle-stitched booklet** | saddle-stitched cover, body (multiple of 4) |
| **Hardcover weekly planner**, **Paperback daily planner** | cover, (endpapers), calendar in the book block |
| **Hardcover photo album** | hard cover, endpapers, spreads for photos |
| **Wall calendar with backing board** | 12 months with a cover, backing (cardboard) |

Click a template: you'll see the first pages of each section and choose the **Format**, **Block pages** and **Page multiple
(signature)** — 16 pages by default; the number of block pages is always a multiple of it. **Colors** — brand or
palette. [Create a project with this template] creates the whole project. The format and layout fields are hidden then — the template provides them.

**Section** templates (calendar, planner, invitation, chapter…) are something else: you insert them into an existing project
in the editor (→ 10.10).

![New project](nowy-projekt.png)

## 2.3 Project menu

[⋯] on the project card: [Preview] (straight away, without the editor, → 19), [Rename], [Duplicate] (e.g. a calendar
for the next year), [Export to file (.makietka)] (→ 2.6), [Collaboration…] (→ 24) and [Delete project].
In someone else's project, instead of duplicating and deleting you get [Make my own copy] and [Leave project] (→ 24.6).

![Project menu](menu.png)

## 2.4 Saving

There's no “Save” button — every change saves itself, first on the device and a moment later
to your account. Without internet, changes wait on the device and are sent automatically when the connection is back. The save status
is shown by the cloud next to the project name (→ 2.1).
A change made right before closing the tab is kept too: it's saved on the device and reaches your account the
next time you open the project.

## 2.5 Several devices and undo

You can have the same project open on several devices or in several tabs. A change made
on one appears on the other after a moment, without refreshing.

A new version of Makietka switches on by itself, right away, when there's internet – also in an open project: your changes are saved
first, and then the project reopens in the same place (with the undo history). While you're typing text,
it waits until you finish (at most 20 seconds). Without internet, the version saved on the device works. The version number
is shown in **Settings**, below the list of sections.

When a project was changed in two places at once, the app **merges the changes element by element**:
if you move a photo on one device and fix a heading on the other, both changes are kept.
It only asks when the same element was changed in both places: the “The same thing was changed on two
devices” window shows each such element with a choice of **From this device** or **From the account** (the account
version is selected). [Use the account version everywhere] picks it for all of them, [Apply] confirms.

[Undo] (<kbd>Ctrl</kbd>+<kbd>Z</kbd>) and [Redo] (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>)
cover the whole project: elements, pages, sections, masters, styles, data and series. The history goes back
80 steps and stays after you close the project — on the same device. Undo only reverses
changes made on this device; changes by other people and AI stay.

## 2.6 Project file

- [Export to file (.makietka)] ([⋯] menu on the card) saves the whole project, with images and fonts,
  to a `.makietka` file — it's a backup or a way to hand the project over.
- [Import from file] next to [New project] loads a project from a `.makietka` file (on a narrow screen it's just an arrow icon).
  The same way you can open a project from **InDesign** (`.idml` – in InDesign: File → Save As → InDesign Markup) and from
  **Scribus** (`.sla`): you get a new project with pages (a section for each page format, bleed and margins from the file),
  text frames with formatting (linked frames still flow text), shapes in color (CMYK converted
  to RGB) and images stored in the file. Images that are only linked in InDesign or Scribus can be loaded
  together with the project in a ZIP file (in InDesign: File → Package; in Scribus: File → Collect for Output) – without them,
  grey boxes with the file name stand in their place. Data merge fields from InDesign and Affinity (`<<imie>>`) and
  from Word and Publisher (`«imie»`) become Makietka fields (`{imie}`) – all that's left is to load the data (→ 14).
  This also works with **Microsoft Publisher** files (`.pub`, versions 2002–2019 – Microsoft retired Publisher
  in October 2026): pages in the file's format, text frames in their places with font, size,
  bold, italic, underline and alignment, linked frames as flowing text, master page
  elements under the content, photos (JPEG, PNG, GIF), colored frame backgrounds and simple shapes. Images in the old
  Windows formats (WMF, EMF) can't be displayed by the browser – grey boxes stand in their place. Older files (Publisher
  98/2000) must first be saved in a newer version.
  After loading, the **“What came over from…”** window tells you what was simplified: a gradient replaced with a single color, shadow
  and other effects skipped, a rotated image inserted without rotation, an IDML table as text with tabs, text on
  a path and a Scribus table as a grey box, missing images, paragraph styles as plain formatting. [Show]
  opens the page with the first such element. Simplified elements are marked and appear in the
  **Preflight check** as “From import: …” – the [Checked] button removes the mark once the element is
  fixed. Formatting of parts of text (e.g. a bold `<<imie>>` field) is kept for merge fields too.
- The app installed on a computer opens `.makietka` files with a double-click (→ 28.4).

**Text from and to other programs.** In the editor, the **⋯** menu:

- [Insert text from file (Word, ODT, Markdown)…] — a `.docx` (Word), `.odt` (LibreOffice, OpenOffice), `.md`
  (Markdown) or `.txt` file goes into one frame on the current page, within the margins, with **Add pages** turned on:
  the text spreads itself over as many pages as needed. Headings stay headings (larger, bold), chapters
  (heading 1) start on a new page, and bold, italic and underlined parts of text are kept. Tables
  come in as rows with tabs; images and footnotes from the file have to be inserted separately — the app will tell you how many there were.
- [Save text as Word (.docx)] and [Save as e-book (EPUB)] — just the page content in reading order
  (without the cover), with headings and formatting of parts of text; the e-book has a table of contents and each chapter in a separate file.
  The page layout and images stay in Makietka.
- [Save for Scribus (.sla)] — the whole project with its page layout for the free layout program Scribus (1.5 and 1.6):
  pages in print order, with bleed and margins, series expanded and data filled in. Texts are ordinary
  Scribus text frames (font, size, color, bold, italic, underline, alignment,
  paragraphs) — you can keep editing them; rectangles, ellipses, polygons, lines and paths are shapes with colors;
  photos, tables, calendars, groups and elements with a shadow or transparency come in as images (300 dpi)
  stored in the file itself. Fonts must be installed on the system — the app tells you which ones the file uses.
  Die-cut lines don't transfer (they're in the file for the cutting plotter).
- [Save for InDesign (.idml)] — the same in IDML format, which opens in Adobe InDesign (CS4 and newer), as well as
  Affinity Publisher and QuarkXPress: text frames with formatting, shapes with colors, the rest as images
  embedded in the file. Each page is a separate document page (not joined into spreads); margins and bleed
  are kept.
- [Save for Word with page layout (.docx)] — project pages as Word document pages: text frames (text
  boxes) with font, color, alignment and line spacing, shapes and images in their places, page background;
  tables, calendars and elements with effects as images. LibreOffice (Writer) opens such a file too.
- [Save pages as SVG (Inkscape, Illustrator)] — each page as an SVG file in millimetres (ZIP) – for
  Inkscape, Illustrator, Corel, Affinity or LibreOffice Draw.
- **What transfers and what doesn't.** Before downloading the file for Scribus, InDesign and Word, the **“What will transfer
  to…”** window lists what goes over unchanged, what **turns into an image** (looks the same but can't be
  edited: tables, calendars, charts, codes, groups, elements with a shadow, transparency, gradient, dashed
  line, text on an arc), what gets **simplified** (series expanded into finished pages, masters merged into
  the pages, styles as plain formatting, linked frames split, Pantone as RGB), what we **can't
  transfer** (links, footnotes, drop caps, die-cut lines) and what you need to **do in the program** (install
  fonts, turn on hyphenation). Each item lists page numbers, and [Show] closes the window without
  downloading and selects the first such element – you can fix it and save again. [Download] saves the file.
- [Series for another program (template + data)…] — mail merge outside Makietka. The project pages appear once (without
  repeating), with fields in place of the data, and alongside them the data from the series table. You can choose:
  - **InDesign / Affinity Publisher** – an IDML template with `<<imie>>` tags, `dane.csv` and an `obrazy/` folder
    (the image column has a name with `@`, e.g. `@zdjecie`, and paths to the files – that's how “Data Merge” reads them);
  - **Scribus** – an SLA template with `%VAR_imie%` variables for the ScribusGenerator plugin and `dane.csv`;
  - **Word / Publisher** – text in DOCX with real merge fields and `dane.xlsx` (Mailings → Select
    Recipients → Use an Existing List).
  Document fields (`{nr}`, `{sekcja}`…) are already calculated. The `CZYTAJ-MNIE.txt` file in the package explains step by step what to do next,
  and at the end it has the same description of “what transferred and how”.
  The other way round: text from Word with merge fields (Insert text from file) comes in with `{imie}` fields.
