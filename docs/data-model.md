# Data Model

This app stores data locally in IndexedDB with a localStorage backup snapshot. The model is intentionally close to a future backend schema so the app can grow beyond a single browser.

## Stores

### profiles

One row per patient profile.

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Local profile id. Current app uses `local-patient`. |
| displayName | string | Patient-facing profile name. |
| diabetesType | string | Example: `Type 1`. |
| timezone | string | IANA timezone when available. |
| createdAt | ISO datetime | Created timestamp. |
| updatedAt | ISO datetime | Last profile update. |

### settings

Current app stores one active settings record with key `active`.

| Field | Type | Notes |
| --- | --- | --- |
| unit | string | `mg/dL` or `mmol/L`. |
| low | number | Low alert threshold. |
| targetLow | number | Target range low. |
| targetHigh | number | Target range high. |
| high | number | High alert threshold. |
| carbRatio | number | Grams of carbohydrate per insulin unit. |
| correctionFactor | number | Glucose drop expected per insulin unit. |
| correctionTarget | number | Correction target glucose. |
| insulinDuration | number | Rapid insulin duration in hours. |
| basalTime | string | Basal reminder time, `HH:MM`. |
| checkInterval | number | Reminder interval in hours. |

### entries

One row per diary event.

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Unique entry id. |
| patientId | string | Links to `profiles.id`. |
| datetime | ISO local datetime | Example: `2026-06-25T08:00`. |
| glucose | number | Glucose value in `glucoseUnit`. |
| glucoseUnit | string | `mg/dL` or `mmol/L`. |
| carbs | number | Carbohydrates in grams. |
| insulin | number | Insulin units. |
| insulinType | string | `rapid`, `basal`, or `other`. |
| meal | string | `breakfast`, `lunch`, `dinner`, `snack`, or `none`. |
| activity | string | `none`, `light`, `moderate`, or `hard`. |
| notes | string | Free text. Avoid storing unnecessary private identifiers. |
| source | string | `manual`, `csv_import`, or future device/app source. |
| createdAt | ISO datetime | Created timestamp. |
| updatedAt | ISO datetime | Last update timestamp. |

## Excel/CSV Import

Enter diary data in Excel using these columns, then save as CSV:

```text
date,time,glucose,glucose_unit,carbs_g,insulin_units,insulin_type,meal,activity,notes
```

Supported insulin types:

- `rapid`
- `basal`
- `other`

Supported meal values:

- `none`
- `breakfast`
- `lunch`
- `dinner`
- `snack`

Supported activity values:

- `none`
- `light`
- `moderate`
- `hard`

## Future Backend Path

When this grows into an app for other patients, the next backend should add:

- A server database such as PostgreSQL or SQLite for a private local clinic deployment.
- User accounts and patient ownership controls.
- Encryption at rest and in transit.
- Audit logs for data changes.
- Role-based access for patients, caregivers, and clinicians.
- Consent-based sharing and export.
- Medical safety review before any dose recommendation feature is expanded.
