# Guide for System Administrators (Admin)

Welcome to the System Admin Guide. You hold the highest level of administrative privileges, responsible for configuring core system settings and managing user access.

---

## ⚙️ Global App Configurations

Admins are responsible for updating key identity information for the Troop, on the **App Config** page.

### Key configurations

- **Parish Name** (required): The name of the parish where the school resides (e.g., Tan Dinh Parish).
- **Diocese Name** (required): The diocese the parish belongs to.
- **Troop Name** (optional): The name of the Eucharistic Youth Group (e.g., Andrew Phu Yen Troop).
- **Troop Logo**: Upload the official logo to display on the login page and reports.
- **Name Format**: Choose the display order for first/last names.
- **Liturgical Calendar options**: Toggle whether Epiphany, Corpus Christi, and Ascension are observed on Sunday.

---

## 🔒 Access Control & Admin Accounts

Only an Admin has the authority to grant system-wide `admin` role privileges to other Catechists.

### Managing Admin access

- Go to the **Catechist Accounts** page (for catechist/staff accounts) or **Student Accounts** page (for student accounts).
- Edit the account of the Catechist you want to upgrade.
- Set the application role to `admin` or downgrade to `user`.
- **Important**: Always keep at least one active account with `admin` privileges to avoid losing administrative access.

---

## 🛠️ Database Management & Maintenance

Oversee database diagnostics and perform maintenance tasks.

- **Convex Dashboard**: Monitor databases, indexes, and evaluate active queries in real-time.
- **Troubleshooting**: Assist Catechists with password resets and debug offline QR attendance sync issues (records queued on a device and synced once back online).
