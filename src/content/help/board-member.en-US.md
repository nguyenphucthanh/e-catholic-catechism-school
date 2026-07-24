# Guide for Board Members (Troop Board / Ban Trị Sự)

Welcome to the Board Member Guide. You are in charge of overall management of the school for each academic year, including staffing, class layouts, and global settings.

---

## 📅 Setting Up a New Academic Year

Setting up and transitioning to a new academic year is the most critical process handled by the Board, via the 5-step **Academic Year Setup** wizard.

### Step-by-step setup

1. Navigate to the **Academic Years** menu.
2. Open **Academic Year Setup** and follow the wizard:
   - **Step 1: Create a New Academic Year** — enter start/end dates.
   - **Step 2: Set the New Year as Active** — makes it the year the app operates in.
   - **Step 3: Bulk Create Classes** — define class sections (e.g. Ấu 1A, Nghĩa 2B).
   - **Step 4: Promote/Enroll Students** — carry students forward from their prior-year class or enroll them fresh.
   - **Step 5: Assign Catechists** — assign catechists as homeroom or co-teacher for each class.

> [!IMPORTANT]
> **Academic Year Locking & Active Status**: Modifications to year-scoped entities (such as creating class sessions, taking attendance, or modifying enrollments) require that academic year to be marked active (`is_active = true`). Inactive or historical academic years are locked to preserve records.

---

## 👥 Managing Personnel & Assigning Roles

The Board assigns all duties for the academic year. These are assignments held by existing Catechist accounts, not separate system roles.

### Board & Branch assignments

- **Board Members**: Assign the board-member assignment to Catechists for the active academic year to grant them management permissions.
- **Branch Leaders / Deputies**: Assign the branch-head assignment to Catechists to lead specific branches.
- **Class Teachers**: Set class roles (Homeroom/Co-teacher) for each classroom.

> [!NOTE]
> **Data Preservation (Soft Deletion)**: Deleting students, catechists, or classes does not destroy data permanently. Entities are soft-deleted (`is_deleted = true`), allowing historical attendance and grade reports to resolve accurately.

---

## 📥 Bulk Importing Data via CSV/Excel

Save time by importing lists of Students and Catechists in bulk via the **Import** page (Admin access).

### Data importing steps

The import wizard has 7 steps:

1. **Upload File** — choose your CSV/Excel file.
2. **Configuration** — set import options.
3. **Map Columns** — match your file's columns to the expected fields (Full name, birthday, saint name, phone number, etc.).
4. **Preview & Validate** — review parsed rows and fix any validation warnings.
5. **Confirm Import** — confirm before committing.
6. **Importing** — the system processes the file.
7. **Import Result** — review what succeeded or failed.
