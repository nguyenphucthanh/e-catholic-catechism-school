# Guide for System Administrators (Admin)

Welcome to the System Admin Guide. You hold the highest level of administrative privileges, responsible for configuring core system settings and managing user access.

---

## ⚙️ Global App Configurations

Admins are responsible for updating key identity information for the Troop.

### Key configurations

- **Parish Name**: The name of the parish where the school resides (e.g., Tan Dinh Parish).
- **Troop Name**: The name of the Eucharistic Youth Group (e.g., Andrew Phu Yen Troop).
- **Troop Logo**: Upload the official logo to display on the login page and reports.
- Configuration of default timezone (`DEFAULT_TIMEZONE`) and default locale (`DEFAULT_LOCALE`).

---

## 🔒 Access Control & Admin Accounts

Only an Admin has the authority to grant system-wide `admin` role privileges to other Catechists.

### Managing Admin access

- Go to the **Accounts Management** (or Catechists list) page.
- Edit the account of the Catechist you want to upgrade.
- Set the application role to `admin` or downgrade to `user`.
- **Important**: Always ensure there is at least one active account with `admin` privileges to prevent system lockouts.

---

## 🛠️ Database Management & Maintenance

Oversee database diagnostics and perform maintenance tasks.

- **Convex Dashboard**: Monitor databases, indexes, and evaluate active queries in real-time.
- **Troubleshooting**: Assist Catechists with password resets and debug offline database sync issues (Offline DB).
