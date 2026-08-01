# How to publish a new release

No software and no coding needed — everything happens in the browser.

There are two data folders in this repository:

| Folder | What it is | Who sees it |
|---|---|---|
| `data-preview/` | the test area | only people with these links |
| `data/` | the published release | everyone, on the real website |

The rule: **preview first, publish second.** The two steps are identical apart
from which folder you drop the files into.

---

## Step 1 — Upload the new CSVs to the preview folder

Open this link. It shows a large drag-and-drop area:

> **https://github.com/UkraineSupportTrackerWebsite/ukraine-support-tracker/upload/main/data-preview**

Drag **all six CSV files** produced by `extract_ust_data.R` onto it:

- `data_explorer.csv`
- `eu_aid_shares.csv`
- `procurement_trends.csv`
- `release_info.csv`
- `total_allocations.csv`
- `weapons.csv`

Always upload all six, even if only some of them changed. Uploading a file that
already exists simply replaces it.

Then scroll down and click the green **Commit changes** button.

## Step 2 — Wait about 10 minutes, then look at the preview

The website rebuilds itself after every upload. You can watch the progress here —
when the yellow dot turns into a green tick, the preview is ready:

> **https://github.com/UkraineSupportTrackerWebsite/ukraine-support-tracker/actions**

Then open both preview pages:

> English: **https://ukrainesupporttrackerwebsite.github.io/ukraine-support-tracker/HTML/english/en_index.html?preview**
> German: **https://ukrainesupporttrackerwebsite.github.io/ukraine-support-tracker/HTML/german/de_index.html?preview**

A red **PREVIEW** bar at the bottom of the page confirms you are looking at the
test data. If the bar is missing, you have opened the live page by mistake —
check that the address really ends in `?preview`.

If the page still shows the old numbers, press **Ctrl + Shift + R**
(Windows) or **Cmd + Shift + R** (Mac) to force a fresh load.

Check the charts. If something is wrong, correct the CSVs and repeat step 1 —
nothing you do in `data-preview/` can affect the live website.

## Step 3 — Publish

Happy with the preview? Upload **the same six files** a second time, to the live
folder:

> **https://github.com/UkraineSupportTrackerWebsite/ukraine-support-tracker/upload/main/data**

Click **Commit changes**, wait about 10 minutes again, and check the live pages:

> English: **https://ukrainesupporttrackerwebsite.github.io/ukraine-support-tracker/HTML/english/en_index.html**
> German: **https://ukrainesupporttrackerwebsite.github.io/ukraine-support-tracker/HTML/german/de_index.html**

That's it. The chart pages themselves never have to be touched for a release.

---

## If something looks broken

**A chart says it could not load the data.** One of the six CSVs is missing from
the folder. Upload all six again.

**The numbers did not change.** Your browser is showing a cached copy — reload
with Ctrl/Cmd + Shift + R. If that doesn't help, the rebuild may not have
finished yet; check the Actions page from step 2.

**The release label at the bottom of the charts is wrong.** It comes from the
`label` column of `release_info.csv`, not from the file name.

**You uploaded to `data/` by accident.** Nothing is lost — GitHub keeps every
previous version. Ask a developer to restore the last commit.

---

## For developers

Preview mode is a single flag, resolved in `assets/data-loader.js`: a `?preview`
query string switches `DATA_BASE_URL` from `data/` to `data-preview/`. Chart
pages inside an iframe have no query string of their own, so they read the
embedding page's — wrapped in a `try/catch`, because on the live Kiel Institute
site the parent page is on another domain, which throws and correctly falls
through to live data. That means the iframe `src` attributes in the index files
stay untouched, and any new page embedding the widgets inherits the behaviour
for free.
