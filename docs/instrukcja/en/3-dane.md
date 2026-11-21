# Part III. Data and series {ikona=dane}

Data tables, fields in text and pages repeated from a table.

# 14. Data tables

You keep data in the project's tables; field values and repeated pages come from them.

## 14.1 The Data window

A table is a sheet: columns have names (e.g. `dzien`, `imie`), and rows have values. Tables provide
the values of fields in text (→ 15) and repeated pages (→ 16).

The window opens with [Data] on the editor's top bar. On the left is the list of the project's tables, on the right the selected table.
[+] adds an empty table, [Import CSV or Excel] — a table from a file (→ 14.2), [Skipped row] — a
`[pomiń]` row (→ 16.4), and [Download table as CSV] gives you the table to finish in a spreadsheet.
Changes made during one opening of the window are undone with a single [Undo].

![The Data window](dane.png)

## 14.2 Importing from Excel and CSV

[Import CSV or Excel] loads an `.xlsx`, `.xls`, `.ods` or `.csv` file:

- the first row of the file holds the column names,
- an Excel file gives one table for each sheet,
- the app detects the separator (semicolon, comma, tab) and special characters by itself,
- numbers and dates go into the table the way they look in the spreadsheet. It's best to split a date into separate
  columns, e.g. `dzien`, `miesiac`, `rok`.

Fixed the data in the spreadsheet? Import the file again. If the project has a table with the same
name, the app will ask whether to replace its data.

### Data source linked to the table

A table remembers where it came from. Below its name you see a bar, e.g. “Data from: goscie.xlsx, sheet »Lista« · loaded
18.11.2026, 14:20”. The original file (up to 5 MB) is stored in the project – it isn't among the images and isn't removed
during cleanup.

- [Load new version…] – you choose the corrected file; fields and series stay. Before the data is replaced, you'll see
  what will change: the number of rows, changed cells, new and removed columns, and separately a warning when a column
  used in page fields disappears (those fields would be empty).
- [Refresh from file] – in Chrome and Edge on a computer, the browser remembers access to the file chosen with
  “Load new version…”. After a fix in Excel, one click is enough (the browser may ask for permission once).
- **changed in Makietka** – a marker on a table that was edited in the Data window after the file was loaded. A new version
  of the file will replace those edits – the replace prompt will remind you of this too.
- The down-arrow icon downloads the stored source file, the table icon – the current data as an Excel file (`.xlsx`),
  the trash can unlinks the source (the data stays).

**Data from a link** (chain icon next to [Import]) – paste the address of a Google Sheet or a CSV/XLSX file on the web.
The Google Sheet must be public: File → Share → Publish to the web → CSV (a regular link to a
sheet accessible to anyone with the link also works). The table remembers the link, and [Refresh from link] downloads the data again,
with the same comparison of changes. Some services don't allow downloading from a browser – the app will
tell you; then download the file and load it with a regular import.

## 14.3 Editing data in the app

- Click a cell and type. <kbd>Enter</kbd> moves one row down, <kbd>Shift</kbd>+<kbd>Enter</kbd>
  makes a new line in the cell.
- Data copied from Excel or Google Sheets is pasted starting at the selected cell (<kbd>Ctrl</kbd>+<kbd>V</kbd>);
  the table grows down and to the right by itself.
- **×** next to a row or column deletes it.
- You rename a column by clicking its header. The app will update that name in all fields in the project.

## 14.4 Cell formatting

Bold, italic and text color from an Excel file carry over to the pages: a value inserted into a field
gets the look of its cell — e.g. holidays in bold red. The look of parts of the
text in a cell carries over too.

In the Data window select a cell (<kbd>Shift</kbd>+click selects a rectangle of several cells) and use:
[B] — bold, [I] — italic, text color, [Clear formatting] (eraser).

The **Carry cell formatting to pages** switch turns the carrying over off — the formatting stays saved
in the table.

## 14.5 Checking values

Next to each column name there are two signs:

| Sign | What it does |
|---|---|
| **≠** | Values in the column shouldn't repeat (e.g. quotes of the day). Repeated cells are red, and before printing the app will list the pages where the same value appears twice. Letter case and spaces don't matter. |
| **☰** | A list of allowed values, e.g. `praca; dom; wolne`. Other values are highlighted and go on the list before printing; in the data template the cells get a drop-down list. [Remove list] removes it. |

# 15. Fields in text

A field is a place in text where a value from a table or from the project goes, e.g. the page number.

## 15.1 Inserting a field

A field is a column name in curly braces, typed into ordinary text, e.g. `Name day: {imieniny}`. On the finished
page the value from the table takes the place of the field.

Select the text and choose a column from the [Insert field] list in the properties. The list starts with the columns
of this page's table, followed by document fields (→ 15.2). You can also type a field by hand.

![Insert field](k-wstaw-pole.png)

In the editor fields have a purple background, and a field the app doesn't recognise (e.g. a typo) — a red one.
The real values are visible in thumbnails, in the preview and in the PDF.

- Table fields work on the pages of a series that uses that table (→ 16).
- A field from an additional table is typed with the table name: `{Tygodnie.haslo}` (→ 16.5).
- A bold field gives a bold value.

![Fields in text](pola.png)

## 15.2 Document fields

Document fields come from the project itself and work on every page, masters included:

{{tabela-pol}}

Fields **from project settings** — `{format}`, `{oprawa}`, `{grzbiet}`, `{stron_bloku}`, `{papier}`,
`{rok_kalendarza}` (and `{projekt}`) — need no typing in: they take their value from the section, cover and calendar settings
and change along with them, e.g. an imprint line “Format {format}, binding {oprawa}, {stron_bloku} pages”. In the
**Insert field** list they're in a separate group, **From project settings**. When the project has no cover or calendar, the field is empty.

When a table column has the same name as a document field, the column wins on that table's pages.

## 15.3 Plain braces

- Whole text without fields: select the text and turn on **Braces { } are plain text, not fields** (the switch
  appears when the text contains braces).
- A field and braces in one text: type the braces twice — `{{` and `}}` become single
  braces, e.g. `Day {dzien}, formula {{x}}` gives “Day 5, formula {x}”.

# 16. Series

A series repeats a page for every row of a table — that's how a 365-day calendar comes from one page.

## 16.1 What a series is

You design one day page — you get 365 pages, each with the data from its own row. A series can
cover several neighbouring pages (a **block**), e.g. a week on a spread: then the whole block repeats together.

Repeated pages aren't saved separately — they're generated on the fly, so a change to the table immediately
changes the publication.

## 16.2 New series

1. Click an empty spot on the page — the properties will show the page settings.
2. In the **Series** field choose [+ New series…].
3. Set up the series in the window (→ 16.3) and click [Save].
4. For the following pages of the block, choose the same series.

![Series in the page properties](k-seria.png)

Series pages have a purple badge in the page list with the number of repeats, e.g. **×31**. **×0** means
that all rows for this page are skipped.

![Repeated pages in the preview](serie.png)

## 16.3 Series settings

The series window opens when you choose [+ New series…], and for an existing series — with the
[Series settings] button in the page properties. Below the **Series** field you can see how many pages will be printed.

| Setting | Meaning |
|---|---|
| **Series name** | The name in the list of series. |
| **Data from table** | The table the rows come from. |
| **How many times to repeat** | Switch: **As many as table rows** or **A fixed number of times** (then the **Number of repeats** field appears) — e.g. 12 months; the data then loops around. |
| **How to read the table** | Switch: **Row per block** (columns e.g. `s1_tytul`, `s2_tytul` for consecutive pages) or **Row per page**. |
| **Complete the last block with pages without data** | The series ends at the last row; with this setting the last block is full. |
| **Keep left and right pages** | In spreads (→ 16.6). |
| **Additional tables** | Data that changes less often than the pages (→ 16.5). |
| **Data the pages need** | Fields used on the block's pages. [Add missing columns to table] adds the missing ones. |
| [Download data template (Excel)] | A file with the columns the pages need (→ 16.7). |

![Segments in the Series window](k-seria-segmenty.png)

## 16.4 Skipped rows

Example: a calendar with a block per week (Monday–Sunday), and the year starts on a Thursday.
Without doing anything, 1 January would land on the Monday page. So add three
**skipped rows** at the start of the table — for Monday, Tuesday and Wednesday.

A skipped row has the `[pomiń]` marker in its first cell. It takes its place in the block, but its
page isn't created: it isn't in the preview, the PDF or the numbering. You insert it with the
[Skipped row] button in the Data window — above the row where the cursor is — or type `[pomiń]` in Excel.

The end of the year needs nothing: the series ends at the last data row.

## 16.5 Additional tables

An additional table provides data that changes less often than the pages — e.g. a quote of the week on the day
pages or a picture of the month. In the series window: [Add table], and then **New row**:

- **every fixed number of pages** — e.g. every 7 pages for weeks,
- **when column “…” changes** — e.g. `miesiac`: a new row where the month changes in the main
  table. You can choose several columns (e.g. month and year) in the following **or column** lists.

A field from an additional table: `{Tygodnie.haslo}`. When an additional table runs out of rows, the series window
shows it in red, and before printing — in the list of warnings.

## 16.6 Series in spreads

**Keep left and right pages – insert a blank page when needed** makes a page designed
as a left page always come out on the left, and a right page on the right. When needed, the app inserts a blank white
page — e.g. after the series, when the data ends on a left page. The blank page counts in the numbering,
as in printed books. [Preflight check] lists where the blank pages are.

## 16.7 Data template

[Download data template (Excel)] gives you a file with exactly the columns the pages require,
together with the data already in the table. The “Instrukcja” sheet describes each column. Columns with a list
of values, image names or a crop have drop-down lists. Import the filled-in file in the Data window.

# 17. Appearance from data

An element's color, position, image or visibility can change on each repeated page.

## 17.1 The From data part

An element can change along with the data on consecutive repeated pages: color, position, size,
rotation, image or visibility. Select the element and expand the **From data** part in the properties.

In the editor the element looks like the template (position 1, the template's color, always visible). The actual look
of each page is visible in the preview, in thumbnails and in the PDF.

![A tab on the edge: a different position and color on each page](zakladki.png)

## 17.2 Color from field

**Color from field** — a column with colors, e.g. `#d1495b`, `2e86ab` or a name in English (`navy`).
An empty or invalid value keeps the template's color. A line and a shape without fill get the stroke color.
With a gradient fill you choose what the color from the field changes: the first color, the last
color or the whole gradient in shades.

## 17.3 Position, size and rotation from field

| Setting | Meaning |
|---|---|
| **Horizontal offset from field**, **Vertical offset from field** | A field with a number — a table column or e.g. `{egzemplarz}` (the repeat number). |
| **Field value is** | **position number** — the element moves by the **Step** (mm) for each position; **Restart every** N goes back to the start. Or **offset in mm** — the number from the table taken directly. |
| **Width from field**, **Height from field** | The value is a **percentage of the template size (100 = unchanged)** or a **size in mm**. **When resizing, keep in place** — which side or corner stays put. |
| **Rotation from field (degrees)** | An angle added to the template's rotation, e.g. a clock hand that's different on each page. |

That's how you make tabs on the page edge — lower on each page — or bars with heights from a table.

## 17.4 Show element

**Show element**: **always** or only when the chosen field **is not empty**, **is empty**
or **equals** the value you enter. Example: a star next to a holiday — the `swieto` column and
“is not empty”.

## 17.5 Image from data

Insert any image as a template — it sets the position and size. In the image properties, in the
**Image from data** part:

| Setting | Meaning |
|---|---|
| **File name column** | A file name in each row, e.g. `styczen.jpg`. Upload all the files at once in the Project images window (→ 7.5). |
| **Replaced image** | **fits in the frame (fully visible)** — with free space at the sides or at the top; **fills the frame (edges cropped)** — without empty bands. |
| **Part of the photo remains** | When filling: center, top, bottom, left or right side — e.g. “top”, so heads aren't cut off in portraits. |
| **Crop from column** | **the same on every page** or a column where for each photo you type `góra`, `dół`, `lewa`, `prawa` or `środek`. |

## 17.6 Text of varying length

Texts from a table have different lengths, but the page layout should stay the same. Give the frame a **Fixed height**
and turn on **Shrink text when it doesn't fit** (→ 5.6). [Preflight check] will list the pages
where the text still doesn't fit.

![A frame with a fixed height](ramka-tekstu.png)

# 18. Examples

Ready-made step-by-step recipes.

## 18.1 Day-per-page calendar

One page per day, with the day of the week, name days and holidays in color.

1. New A5 project, **Spreads** layout (→ 2.2).
2. In the Data window import a **Dni** table with the columns `dzien`, `miesiac`, `dzien_tygodnia`,
   `imieniny`, `swieto` — or ask AI for it (prompt below).
3. On the page insert the texts `{dzien}`, `{dzien_tygodnia}` and `Name day: {imieniny}` (→ 15.1).
4. Click an empty spot on the page and in **Series** create a series with the Dni table (→ 16.2) — 365 pages will be created.
5. Insert a small `{swieto}` text in red and set **Show element → is not empty** (→ 17.4).
6. Add the page number and footer as a master (→ 11.3).
7. Check the preview and export the PDF (→ 19, 21).

{{polecenie: PROMPT_DANE | Prompt for AI: a table of days for a calendar | Copy it, replace the project name and paste it into a chat with an AI that has Makietka connected (→ 25).}}

## 18.2 Planner with a picture of the month

1. Make the day pages as in the calendar (→ 18.1).
2. Add a **Miesiące** table with the columns `miesiac` and `obraz` (file names), and upload the photos in the
   Project images window (→ 7.5).
3. In the series window add it as an additional table: **New row → when column “miesiac” changes** (→ 16.5).
4. Insert an image on the page and in **File name column** choose the `obraz` column of the Miesiące table (→ 17.5).

## 18.3 Personalised invitations

1. A project in invitation format, e.g. 148 × 105 mm.
2. A **Goście** table with an `imie` column — e.g. pasted from a spreadsheet (→ 14.3).
3. Design the invitation and type `Dear {imie}!` in the text.
4. A series with the Goście table — one invitation for each guest.
5. A **For print** PDF split into files or as a single file (→ 21.1).
