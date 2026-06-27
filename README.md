# Type 1 Diabetes Manager

A local-first web app for logging Type 1 diabetes care data.

## What It Tracks

- Glucose readings
- Carbs
- Rapid, basal, or other insulin doses
- Meal context
- Activity level
- Notes for symptoms, illness, site changes, stress, or unusual food
- Trends, time in range, and daily summary metrics
- CSV diary imports from Excel
- Patient profile and settings

## Run Locally

Open `index.html` directly in your browser, or run a local static server:

```sh
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/
```

## Data

Data is stored in your browser with IndexedDB, with a localStorage backup snapshot for portability. Use **Export JSON** regularly to back up your full profile, settings, and log. Use **Export CSV** if you want to review entries in a spreadsheet.

## Excel Diary Import

Use the app's **Template CSV** button or the checked-in templates:

```text
templates/diabetes-diary-template.csv
templates/diabetes-diary-template.xlsx
```

You can enter the diary manually in Excel with the same columns, then save the Data Entry sheet as CSV and import it with **Import CSV**.

Required columns:

```text
date,time,glucose,glucose_unit,carbs_g,insulin_units,insulin_type,meal,activity,notes
```

More details are in:

```text
docs/data-model.md
```

## Scalability Direction

The current app is a private local prototype. The data model now separates patient profile, settings, and diary entries so it can later move to a backend database for multiple patients. Before using it for other patients, add authentication, encryption, access controls, audit logs, consent flows, and clinical safety review.

## Safety

The bolus helper only calculates from settings you enter, such as carb ratio and correction factor. It is for logging and estimation support, not medical advice. Confirm insulin settings and dose decisions with your diabetes care team.
