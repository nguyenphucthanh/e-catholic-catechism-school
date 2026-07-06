[← Back to index](../README.md)

> **Format note:** Schema is database-agnostic. Logical types: `id` (auto-increment or UUID), `ref → Table` (foreign key), `string` (~200 chars), `text` (unbounded), `enum`, `date`, `timestamp` (with timezone), `decimal`, `boolean`.
>
> Constraints: `[required]`, `[unique]`, `[default: x]`, `[immutable]`, `[computed, never stored]`.

## 7.8 — AppConfig (singleton)

Singleton global application configuration — exactly one document exists. No `is_deleted`.

| Field            | Type                  | Constraints                 | Notes                                                                                                |
| ---------------- | --------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `id`             | id                    | [required] [unique]         |                                                                                                      |
| `parish_name`    | string                | [required]                  | Parish name, e.g. "Giáo Xứ Thái Hà"                                                                  |
| `diocese_name`   | string                | [required]                  | Diocese name, e.g. "Tổng Giáo Phận Hà Nội"                                                           |
| `name_format`    | enum                  | [required]                  | `firstName_lastName` or `lastName_firstName`. Controls how `fullName` is stored & how names are sorted alphabetically |
| `logo_storage_id`| ref → `_storage`      | optional                   | Convex storage ID for the app logo. Resolved to a signed URL via `ctx.storage.getUrl()` at query time |
| `logo_url`       | string                | [computed, never stored]    | Resolved signed URL returned by `api.appConfig.get`. Not persisted in the document                   |

### Convex APIs

| Function                   | Type     | Auth          | Notes                                              |
| -------------------------- | -------- | ------------- | -------------------------------------------------- |
| `api.appConfig.get`        | query    | none          | Returns config doc with resolved `logoUrl` or null |
| `api.storage.generateUploadUrl` | mutation | none    | Generates upload URL for logo file                 |

### Usage

- **Sidebar header** (`AppSidebar`): displays logo or `SchoolIcon` fallback
- **Login page**: displays logo or `SchoolIcon` fallback
- **Name sorting**: boards (scores, evaluations, attendance) read `nameFormat` to sort students — if `lastName_firstName`, sort by last word (surname); otherwise sort by full display name
- **Default place value**: sacrament dialogs pre-fill "Parish Name, Diocese Name" as the default received place