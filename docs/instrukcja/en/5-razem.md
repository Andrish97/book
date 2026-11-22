# Part V. Together with others {ikona=uzytkownik}

Working on a project together, and the AI assistant.

# 24. Collaboration

Working on a project together: invitations, roles and comments.

## 24.1 Inviting

Each person works in their own account, and changes show up for everyone live. Choose [⋯] → [Collaboration…]
in the editor or on the project card.

![Collaboration in the ⋯ menu](k-menu-wspolpraca.png)

In the **Invite someone** section:

1. In the **Email or username** field, type an address or a name — after two letters, matching
   usernames appear.
2. Choose the **Role** (→ 24.2).
3. Click [Invite].

The app sends an email with an invitation link. You can also copy the link and send it yourself. When
you invite by name, you don't see that person's email address. If that person has turned off emails
about invitations (→ 27.6), the app tells you — they will see the invitation in the app.

![The Collaboration window](wspolpraca.png)

## 24.2 Roles

| Role | What they can do |
|---|---|
| **can edit** | Changes pages, data, masters and styles; exports PDF. |
| **can view** | Opens the project in preview only. |
| **Owner** | All of the above, plus invites, changes roles, revokes access, shares a preview link and deletes the project. |

## 24.3 Accepting an invitation

Click the link in the message. If you have an account, you'll also see the invitation in the app: an
[Invitations] button with a number appears in the project list. An accepted project is on your list with
the owner's badge.

The invitation is accepted by whoever has the link — even from a different address than the one it was sent to.
The Collaboration window always shows who is really in the project.

With notifications turned on (→ 27.6), you'll learn about an invitation right away.

## 24.4 Working live

- Changes are merged element by element: when you fix the title and someone moves a photo, both
  changes stay. For the same element, the app will ask (→ 2.5).
- Circles with initials on the editor and preview bar show who else has the project open; point to
  a circle to see which page they're on.
- [Undo] undoes only your own changes.

## 24.5 Managing people

In the Collaboration window, the owner can, for each person:

- change the **role** in the drop-down list,
- [Revoke] — revokes access immediately; changes that person has already saved stay,
- for a pending invitation: [Copy invitation link], [Resend invitation email]
  and [Revoke invitation].

## 24.6 Leaving a project and making a copy

A collaborator can [Leave project] — in the [⋯] menu on the card or in the Collaboration window.
[Make my own copy] creates your own project with the same content.

## 24.7 Comments

A comment is a note pinned to a spot on the page or to an element — like a sticky note on a printout —
shown as an orange pin with a number. Everyone in the project can comment, including people with the
**can view** role (in preview). Comments are not included in the PDF.

![The Comment tool and the Comments button with a counter](k-komentarz-narzedzie.png)

**Adding a comment**

1. Click [Comment] on the toolbar (in preview: [Comments] → [New comment]).
2. Click a spot on the page. If you select an element first, the comment is pinned to it right away.
3. Type the text and click [Add comment] (or Ctrl+Enter). Esc cancels.

Type **@** and the start of a name to mention a person in the project — the app suggests names.

**The comment list**

[Comments] on the editor's top bar and in preview shows the number of unresolved threads. Clicking
a pin opens its thread.

![The Comments panel with a thread and a reply](komentarze.png)

- Filters: **Unresolved**, **All**, **Mine** (my threads, my replies and mentions of me).
- A thread contains the replies, [Reply] and [Show on page].
- [Resolve] closes a finished thread and hides the pin; [Reopen] (the **All** filter) brings it back.
- You can edit your own comment with the [Edit] pencil (marked "(edited)"); <kbd>Ctrl</kbd>+<kbd>Enter</kbd> saves and sends.
- A comment can be deleted by its author or the project owner — it disappears for everyone at once, along with the replies.
- A comment on an element follows the element; if you delete the element, the pin stays in that spot.
  A thread from a deleted page stays in the list, labeled "page deleted".
- Comments are added on pages, not on masters.

Comments appear for everyone at once; a reply you're writing doesn't disappear when someone adds something.
You'll also learn about new ones from notifications (→ 27.6).


An AI connected with a key also reads comments, replies to them and can resolve them after a fix (→ 25.1).

# 25. Working with AI

An AI assistant can build and change your projects together with you.

## 25.1 What AI can do

An AI assistant (Claude, ChatGPT and others) connects to Makietka through a **connector**: an address with your key,
which you add in the AI app.

| AI can | AI cannot |
|---|---|
| create and delete projects (with full access) | see projects outside the key |
| add, change and copy pages; add, change, align and evenly distribute elements; change styles and masters | change your account or password |
| fill in data tables and set up series | make a PDF file without Makietka — your browser renders it (→ 25.5) |
| upload, insert and replace photos | |
| read comments, reply to them and add its own (→ 24.7) | |
| request a PDF file or a PNG of a page and give you a download link (→ 25.5) | |

Write to the AI normally, as you would to a graphic designer: what you want to make, in what format, how many pages, what mood.
If you have the project open, the changes appear in the editor after a moment. The AI's changes merge with yours
like a collaborator's changes (→ 24.4).

## 25.2 A key for AI

[Account settings] → **Artificial intelligence** has a switch at the top between four ways of working with AI: **Chat in Makietka**,
**Connector in an AI app**, **Copy and paste** and **Chat that opens web pages**. Each tab explains how that way works, what you need and how much it
costs, and below it shows your keys with an [Edit] button and an [Add key] button. You always add and edit a new key
in a small window.

| Section | What for | Cost |
|---|---|---|
| **Chat in Makietka** | Provider API keys (Anthropic, OpenAI, Gemini, DeepSeek, Mistral, xAI, OpenRouter, OpenAI-compatible) for the AI Assistant in the editor (→ 25.6). In the window you choose the provider, paste the key ([Where do I get a key?] leads to the provider's page) and click [Save key]. The keys are encrypted with your keys password – nobody but you can read them, not even Makietka's administrators. This is also where you see the one-day "Chat in Makietka" keys the assistant uses to read the open project. | You pay the provider. Without a key: "copy and paste" mode (→ 25.6). |
| **Connector in an AI app** | The access key and connector address for Claude, ChatGPT and other apps with MCP (→ 25.3). Sign-in connections also end up here ("Connector: app name"). | **Most likely a paid plan** of the AI app (ChatGPT – paid plans; Claude – one custom connector on the free plan). |
| **Copy and paste** | Any chat in the browser, including free ChatGPT, without a key: you choose a project and [Open with the AI Assistant] – the project opens with the AI Assistant in "copy and paste" mode (→ 25.6). The chat gets no key or address. | Nothing. |
| **Chat that opens web pages** | An access key and a ready-made prompt with addresses for a chat that opens any web pages by itself (→ 25.7). ChatGPT doesn't do that – use "Copy and paste" then. | Makietka charges nothing. |

![Artificial intelligence in account settings](k-konto-ai.png)

The window for a new access key (connector and regular chat):

| Setting | Meaning |
|---|---|
| **Description (for you)** | E.g. "Claude – calendar". |
| **AI can** | **read and edit** or **read only**. |
| **Valid for** | 1 day, 7 days, 30 days, 90 days, a year or no expiry. |
| **Selected projects** | The projects the key gives access to — yours and those shared with you. |
| **Full access – all projects, including creating and deleting** | Also projects added later. The AI always confirms deleting a project by its name. |
| **When editing, AI may also** | Five switches (all on by default): add, delete and reorder pages; change masters and styles; change data tables and series; upload, replace and delete images; make PDF and PNG files. When off – the AI gets a refusal with an explanation; this is enforced by the Makietka server, not the AI app. Shown only for a "read and edit" key. |

[Create key] shows the **Connector address** (or a ready-made prompt for a regular chat). When you have a keys password,
Makietka remembers the key encrypted with that password; without a password – [Remember key] in the window. [Done] closes the window.

Each key in the list has [Edit] – editing opens in a window, just like adding:

| In the window | What it does |
|---|---|
| [Show key] | Shows the connector address or the prompt for a regular chat (and the key itself) again – for copying. Works for keys remembered in the vault. |
| **Range** | Selected projects or full access — the address doesn't change. |
| **Permissions** | The same five switches as for a new key. The key list shows what a key can't do (e.g. "without: pages, images"). |
| **Validity** | A new period starting today (1 day … a year or no expiry), also for a key that has already expired; "no change" keeps the current one. |
| [Save changes] | Saves the range and validity. |
| [Revoke key] | Turns the key off immediately. |

A provider API key in the edit window: [Show key], **Replace key** (you paste a new one and click [Save]) and [Delete key]. The **Model and connection** section (also when adding): **Default model** – the one the AI Assistant starts with (the list suggests the provider's models), for "Other – OpenAI-compatible" also the **API address**, and [Test connection] – Makietka asks the provider for the list of models and tells you whether the key works, and if not – why (wrong key, no funds, limit, model unavailable, no internet).

When the keys are encrypted on this device, the Chat in Makietka section shows [Unlock] – you enter the keys password once
per device.

![Artificial intelligence settings](dostep-ai.png)

## 25.3 Connecting in the AI app

**The simplest way – with sign-in (no copying of the key).** In the AI app, add a custom connector at the address
`https://api.makietka.app/mcp` (without a key) and choose sign-in (OAuth). The app opens the Makietka page
**Connect to Makietka**: you sign in with your password, see who is asking (e.g. "Claude"), choose projects (or
all of them), reading only or changes too, and the validity – [Allow] returns to the AI app, [Deny] ends the connection.
The connection is an ordinary access key "Connector: app name" – you can see it in the Artificial intelligence settings and
revoke it. The AI app doesn't get your password. The second way – the address with a key from the window – works as before:

| App | How to connect |
|---|---|
| **Claude** (claude.ai, desktop and mobile app) | **Settings → Connectors → Add custom connector**, name "Makietka", paste the address. In a conversation, turn on the connector in the tools menu. |
| **Claude Desktop** | In the Artificial intelligence window: [Download the Claude Desktop extension], double-click the downloaded file and paste the key. The extension also reads files from your disk. |
| **ChatGPT** | **Settings → Apps → Add custom MCP server**, paste the address, authentication: none. |
| **Claude Code** and other MCP programs | The command from the **Advanced** section in the Artificial intelligence settings. |

To check: write to the AI "Show my projects in Makietka".

The easiest way is to copy the "Connect Makietka" prompt and paste it into the conversation — the AI will recognize which
app you're in and tell you what to click:

{{polecenie: PROMPT_PODLACZENIE | The "Connect Makietka" prompt | Paste it into a conversation with the AI – it will guide you through connecting in your app.}}

> Tip: Connectors are usually part of paid AI app plans. On a phone you can usually only
> use connectors added earlier on a computer.

## 25.4 Photos through AI

- **ChatGPT** takes photos dropped into the conversation directly.
- **Claude** uploads small graphics from the conversation by itself; **Claude Desktop with the extension** — files and folders
  from your disk.
- **An upload link always works:** ask the AI for a link — it opens this project with the Project images window,
  you drop photos or a ZIP there, and the AI sees them and carries on.
- The AI can also download an image from a web address or from a Google Drive or Dropbox link shared
  with "anyone with the link", and draw its own SVG graphic.

The AI doesn't delete a photo that's placed on a page — it replaces it with a new file in the same spot.

## 25.5 PDF file through AI

Ask the AI e.g. "Make a print-ready PDF" or "Show the cover as an image". Makietka renders the file with the same
code as [Export to PDF…] (→ 21):

- **Makietka is open** (any tab, on a computer or a phone) — it takes the request by itself.
  A bar "AI requested a PDF export…" appears at the top, and after a moment a notification with a
  [Download] button. The AI gets a download link for the file and the notes from the preflight check.
- **Makietka is closed** — the Makietka server makes the file (in about a minute), and the AI gives you the download link
  when you ask again. You don't have to open anything. If the server can't manage (e.g. the daily limit), the AI gives you a link
  to the app — once you open it, the file is made automatically.

The download link works without signing in for 7 days, then the file disappears from the account. The AI can request the whole
project, one section or selected pages, a print file (with bleed and crop marks, also PDF/X)
or one for reading on screen, a booklet for folding, or a PNG of a single page.

## 25.6 AI Assistant in Makietka (own key)

No separate AI app needed: in the editor, the **⋯** menu → [AI assistant (own key)…] opens a chat next to the page
(on a phone — a window).

1. **Provider** — Anthropic (Claude), OpenAI (ChatGPT), Google Gemini, DeepSeek, Mistral, xAI (Grok),
   OpenRouter (hundreds of models from one account) or **Other – OpenAI-compatible API** (with its own address). Next
   to the name you see what it can do: **chat and project changes** – every provider reads and changes the project with
   Makietka's tools; **and images** – Google Gemini also draws images.
2. **API key** — from the chosen provider ([Where do I get a key?] leads to their page). With OpenRouter, instead of
   pasting a key, [Sign in with OpenRouter] is enough — you sign in and approve access on their side.
3. **Model** — the list of models comes from the provider after you enter the key; you can also type a name.
4. **In this project, AI can** — **read and edit** or **read only**.

Write what to do (Enter sends, Shift+Enter — new line). The AI uses the same tools as the connector
(→ 25.1); the chat shows which ones (🔧), and the changes appear in the editor right away. [Stop] halts
after the current step. The sliders icon in the header shows and hides the settings.

- **The keys are encrypted and stored in your account.** With the first key, Makietka asks for an **AI keys password**
  (at least 8 characters, preferably different from your account password). The browser encrypts the key with it (AES-256) and only
  then saves it to your account – the server holds only the encrypted record. Without your password nobody can read it,
  **not even Makietka's administrators**. On each new device you enter the password once; after that the device remembers it.
  Lost password: in the password window, [Forgot it – delete saved keys] and paste the keys again.
- The conversation goes from your browser straight to the provider, and you settle the cost with them.
- The AI sees only the open project — through a one-day "Chat in Makietka" access key, visible
  in [Account settings] → **Artificial intelligence** (→ 25.2); you can revoke it there.
- Changing the provider or model starts a new conversation.

**No key and no fees – "copy and paste".** The provider **Any chat without a key – copy and paste** works
with any AI chat in the browser, including free ones (ChatGPT, Claude, Gemini, Copilot…), without an API key:

1. Write what to do in the Makietka chat. Makietka copies a ready-made prompt to the clipboard: rules, a list of tools,
   the project's state and your task (you can also see it in the conversation, with a [Copy] button).
2. Paste it into the AI chat. It will answer briefly and add a `makietka` code block with commands.
3. Paste its whole answer into the Makietka chat and send it – Makietka runs the commands (🔧) and copies the results.
4. Paste the results to the AI chat – it will see what worked and, if needed, send further commands.

The permissions are the same as with your own key (a one-day "Chat in Makietka" key, reading or changes).

The answer appears in the conversation live, as the AI writes it (Anthropic, OpenAI and compatible, Gemini).

**Photos in the conversation.** The paper clip next to the message field attaches photos (PNG, JPEG, WebP, GIF, up to 5 MB). The AI sees them
(the model must support images), and Makietka immediately uploads the original to the project (the "Project images" window), so the AI can
put it on a page. In "copy and paste" mode the photo also goes to the project, but the browser chat won't see it.

**When something doesn't work,** the assistant tells you in plain words what happened: the provider rejected the key, no funds in the provider account,
too many requests, model unavailable or without tool support, no connection. When the provider is overloaded, Makietka
retries the request twice by itself before reporting an error.

**Consent for risky changes.** Before the assistant deletes pages, 3 or more elements at once, images or the project, changes
3 or more pages in one save, or fully replaces masters, styles, tables or series, a question appears in the conversation:
"AI wants to … Allow?" with the buttons [Allow], [Always allow in this conversation] and [Don't allow]. After a refusal nothing
changes, and the AI is told you didn't allow it and asks what to do instead. The same goes for "copy
and paste" mode: the question appears when the pasted chat answer contains such a change.

**Images and comics in the chat.** The assistant can also draw: an image from a description into a frame or onto the
page (like [AI ▾] → **Image from a description…**, → 7.11), comic page panels from the script and cards (→ 10.13),
bubbles from the script and a cost estimate. Google Gemini draws the images with the Gemini key from your vault, even
when you chat with another provider. Before every paid drawing the chat asks with the amount, e.g. “AI wants to
generate the image “Tulips in the garden” (cost about 0.14 PLN). Allow?” – there is no [Always allow in this
conversation] here; after [Don't allow] nothing is charged. The assistant draws in **Draft** quality unless you ask
for better.

Example requests:

- “Add the title Spring in the garden on this page, a frame below it, and draw tulips in it.”
- “Draw the panels of page 2 of the comic and place the bubbles.”
- “How much will it cost to draw 10 images for print?”
- “Translate all the texts on this page into English.”

Changes and images appear in the editor during the conversation – the chat doesn't have to be closed.

## 25.7 AI that can open web pages (no connector)

The connector address (→ 25.2) **opened like an ordinary web page** shows a description of the access and a list of tools in plain text.
An AI that can read pages from the web (e.g. free ChatGPT or Claude with search) can therefore work
without adding a connector: in the **Artificial intelligence** settings, right after creating a key, [Copy for a regular chat] gives you
a ready-made prompt with the address – paste it into the conversation; the AI will show your projects and ask what to do. It calls tools by opening the addresses
`…/n/<tool>?parameter=value` (complex parameters as `?json=…`); the response is the result or a description of the error.
The permissions come from the key – a **read only** key won't change anything.

> Note: Some chats open only addresses they got from the user or found themselves – not the ones they
> build. Then reading works (links from the description), and for changes use "copy and paste" mode or the connector.

> Note: ChatGPT opens only addresses you paste (not the ones it builds itself, nor links found on a page). That's why the prompt contains ready-made addresses for reading: projects, project overview and format description – it will read, but usually won't make changes. For changes without a paid plan, use the AI Assistant in "copy and paste" mode (→ 25.6).

## 25.8 Security

The AI gets at most your permissions: in a project you can only view, the key only reads,
and when the owner revokes your access, the key loses it immediately.

> Note: The connector address contains the key — whoever has it has access to the selected projects. Don't publish
> it, give the shortest validity that's enough, and revoke the key once the work is done.

# 26. Example: a comic with AI

## 26.1 From idea to file

An A5 booklet with a cover: the AI lays out the panels and speech bubbles, you provide the drawings and make the decisions.

1. Create a key with **full access** and **read and edit** — the AI will create a new project (→ 25.2).
2. Copy the "Print-ready comic" prompt (below), add your idea and send it. The AI first shows a page plan —
   correct it before it starts.
3. Open the new project — you'll see pages, panels and speech bubbles being added.
4. Ask the AI for an upload link and drop in your drawings (→ 25.4). The AI will put them into the panels.
5. Fix whatever you like: the text in the bubbles (the "Speech bubble" style changes all of them at once), the cropping, the page order.
6. Make the cover as a separate section with a spine (→ 10.6).
7. [Preflight check], then a PDF **For print** (→ 20, 21).

{{polecenie: PROMPT_KOMIKS | The "Print-ready comic" prompt | Copy it, add your idea at the end and send it to an AI with Makietka connected.}}

> Tip: A saddle-stitched booklet has a page count divisible by 4 (8, 12, 16…). Prepare the drawings for print
> at no less than 300 dpi at the panel size.
