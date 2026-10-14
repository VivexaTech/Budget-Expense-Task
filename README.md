# Company Budget & Task Management Android App

A real, production-ready enterprise Android mobile application engineered for internal company budget tracking, client income collection, corporate expense tracking, monthly financial targets, deterministic task readiness allocation, and employee notifications.

Built with **React Native**, **Expo (SDK 57, Expo Router)**, **TypeScript**, **Firebase Authentication**, **Cloud Firestore**, and **Vercel Serverless Functions (Firebase Admin SDK)**. Inspired by the clean usability, typography, and spacing of Google Tasks, Google Calendar, and Material Design 3.

---

## 1. Five Core Product Questions Answered Instantly

The dashboard answers these five critical company financial questions on the home screen:

1. **What is the company's monthly earning target?**
   - Automatically computed from:
     $$\text{Monthly Target} = \text{Configured Fixed Expense Budget} + \text{Additional Expected Expenses} + \text{Desired Profit Target}$$
   - Can also be explicitly overridden by the Administrator.
2. **How much income has been collected?**
   - Aggregated from auditable client income submissions recorded by employees.
3. **How much money remains available?**
   - Authoritative calculation:
     $$\text{Available Balance} = \text{Opening Balance} + \sum \text{Valid Income Received} - \sum \text{Verified Company Payments} - \sum \text{Reimbursed Outflows}$$
4. **Which company expenses are due, and when?**
   - Chronological task list ordered by `dueDate`, clearly marking overdue items without visual aggression.
5. **Which expenses are financially ready to be paid?**
   - Verified through deterministic fund allocation in priority order: pending tasks transition to `READY_TO_COMPLETE` when unallocated cash covers them.

---

## 2. Architecture & Security Separation

```
┌────────────────────────────────────────────────────────┐
│             Android Mobile App (React Native)          │
│   • Google-quality light theme (Tokens #1A73E8, etc.)   │
│   • Expo Router (Tabs, Modals, Dynamic Routes)         │
│   • Auto-filled employee identity snapshots            │
│   • Offline cache & persistent auth session            │
└───────────────┬──────────────────────────▲─────────────┘
                │                          │
       Direct Firebase Reads       Authenticated Calls
       & Client Submissions       with Bearer ID Token
                │                          │
┌───────────────▼──────────────┐  ┌────────┴───────────────────────────┐
│       Cloud Firestore        │  │     Vercel Serverless Functions    │
│   • users/{uid}              │  │     (Powered by Firebase Admin SDK)│
│   • budgets/{monthKey}       │  │                                    │
│   • tasks/{taskId}           │  │ • /api/create-employee             │
│   • incomeEntries/{incomeId} │  │ • /api/recalculate-eligibility     │
│   • expenseEntries/{id}      │  │ • /api/complete-task               │
│   • expenseGroups/{groupId}  │  │ • /api/recurring-tasks             │
│   • activityLogs/{logId}     │  │ • /api/send-notification           │
│   • notificationEvents/{id}  │  │                                    │
│                              │  │ [Admin credentials & FCM secrets   │
│ [Protected by Security Rules]│  │  never exposed on mobile device]   │
└──────────────────────────────┘  └────────────────────────────────────┘
```

---

## 3. User Roles & Capabilities

### Admin Role
- **Employee Provisioning**: Create employee accounts with employee IDs and temporary passwords without signing out of the admin session.
- **Account Management**: Activate / deactivate employee accounts; trigger password reset links.
- **Budget Control**: Set monthly opening balances, fixed expense budgets, additional expenses, and profit targets.
- **Financial Tasks**: Create fixed tasks (rent, utilities, salaries) and configure recurring templates.
- **Task Review & Payment Confirmation**: Review `READY_TO_COMPLETE` tasks with current available balance verification and record payment confirmation notes.
- **Expense Review**: Approve, reject, or mark flexible expenses as paid/reimbursed.
- **Audit Reports**: Inspect company-wide immutable activity logs and monthly financial statements.

### Employee Role
- **Automatic Identity**: Employee Name and Employee ID are automatically populated from the authenticated session; identity spoofing is prevented by Firestore Security Rules.
- **Record Income**: Submit client payments with amount, payer name, work description, payment mode (UPI, Cash, Bank Transfer), and notes. Triggers backend eligibility recalculation.
- **Submit Expenses**: Record corporate out-of-pocket expenses.
- **Flexible Grouping**: Expenses are automatically grouped by `(employeeId + monthKey)`; individual item records are preserved for itemized review.
- **Read-Only Access**: View company targets, progress, and task statuses without unauthorized controls.

---

## 4. Local Development & Testing

### Prerequisites
- Node.js 18+ (tested on Node v24)
- NPM 9+
- Expo CLI (`npx expo`)

### Installation

```bash
# Clone or navigate to the workspace
cd "Expense Manager"

# Install dependencies
npm install

# Run financial logic test suite (100% assertions passed)
npx ts-node tests/financialLogic.test.ts

# Run strict TypeScript verification
npx tsc --noEmit

# Start Expo development server
npx expo start
```

### Pre-Configured Demo Credentials

For rapid verification, the login screen includes **Quick Demo Presets**:

- **Administrator**: `admin@company.internal` / `AdminPass123!`
- **Employee**: `employee1@company.internal` / `EmployeePass123!`

---

## 5. Firebase Setup Guide

1. **Create a Firebase Project** at [console.firebase.google.com](https://console.firebase.google.com).
2. **Enable Authentication**:
   - Enable **Email/Password** provider in Authentication > Sign-in method.
3. **Enable Cloud Firestore**:
   - Create database in production mode.
   - Deploy Security Rules from `firestore.rules`:
     ```bash
     firebase deploy --only firestore:rules
     ```
   - Deploy Composite Indexes from `firestore.indexes.json`:
     ```bash
     firebase deploy --only firestore:indexes
     ```
4. **Obtain Client Configuration**:
   - Register an Android App (package: `com.company.budgettaskmanager`) or Web App.
   - Copy the configuration into your environment (`.env`).
5. **Generate Service Account Key for Backend**:
   - Go to Project Settings > Service Accounts > Generate New Private Key.
   - Use these values in Vercel environment variables.

---

## 6. Vercel Backend Deployment Guide

The backend functions live in `api/` and deploy automatically to Vercel:

1. Link or import the repository in [Vercel](https://vercel.com).
2. Set the following **Environment Variables** in Vercel Project Settings:
   - `FIREBASE_PROJECT_ID`: Your Firebase project ID
   - `FIREBASE_CLIENT_EMAIL`: Service account email
   - `FIREBASE_PRIVATE_KEY`: Service account private key (with escaped newlines `\n`)
   - `CRON_SECRET`: Random secure string for authenticating cron jobs
3. Deploy the project (`vercel --prod` or git push).
4. The recurring task scheduler will run on the 1st of every month at midnight UTC as configured in `vercel.json`:
   ```json
   {
     "path": "/api/recurring-tasks",
     "schedule": "0 0 1 * *"
   }
   ```
5. Set `EXPO_PUBLIC_API_URL` in the mobile app environment to your Vercel deployment URL (e.g. `https://your-api.vercel.app`).

---

## 7. Push Notifications Setup (Android & Expo Go Compatibility)

1. **Expo Go (SDK 53+) vs. Native APK Adaptive Detection**:
   - Starting with Expo SDK 53+, remote push notification tokens (`getExpoPushTokenAsync`) are deprecated and unsupported inside the Expo Go client app.
   - The app dynamically detects the runtime environment via `isRunningInExpoGo()` using `Constants.appOwnership` and `Constants.executionEnvironment`.
   - **In Expo Go**: Remote push token generation is cleanly bypassed without warning logs or errors. Notification channels and local alerts remain fully active, allowing full UI and feature testing.
   - **In Android Development Build / Standalone APK**: Push token generation automatically engages on physical devices with the configured EAS `projectId`, registers the device FCM push token in Firestore, and receives server-dispatched FCM alerts.
2. **Android Channel**:
   - The app automatically registers an Android notification channel `financial-alerts` with high importance, vibration, and Google Blue accent `#1A73E8`.
3. **Push Token Registration & Pruning**:
   - When a user signs in on a native build, their device token is saved in `users/{uid}.pushToken`.
   - Stale or unregistered tokens are automatically detected and pruned by `/api/send-notification`.
4. **Deduplication**:
   - Notifications use an idempotency key `READY_${taskId}_${monthKey}` recorded in `notificationEvents` so that redundant alerts are never sent when unrelated income entries are submitted.
5. **Deep Linking**:
   - Tapping an alert deep-links directly to the task details via scheme `companybudget://tasks/{taskId}`.

---

## 8. Android Build (EAS Build)

The project includes pre-configured `app.json` and `eas.json` for EAS Build.

### Build an Installable Android APK (Internal Preview)

```bash
# Login to Expo Application Services
npx eas login

# Run build for Android APK
npx eas build -p android --profile preview
```

### Build a Production Android App Bundle (.aab)

```bash
npx eas build -p android --profile production
```

---

## 9. Codebase Structure

```
Expense Manager/
├── api/                             # Vercel Serverless Backend (Firebase Admin SDK)
│   ├── _firebaseAdmin.ts            # Admin SDK initialization & token verification
│   ├── _types.ts                    # Vercel request/response types
│   ├── create-employee.ts           # Admin employee creation endpoint
│   ├── recalculate-eligibility.ts   # Authoritative financial engine
│   ├── complete-task.ts             # Admin review & payment confirmation
│   ├── recurring-tasks.ts           # Idempotent recurring tasks generator
│   └── send-notification.ts         # Deduplicated FCM push dispatcher
├── app/                             # Expo Router Navigation Structure
│   ├── _layout.tsx                  # Root layout with auth guard & safe area
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx                # Google-styled login with demo presets
│   ├── (tabs)/
│   │   ├── _layout.tsx              # Bottom tab bar (Home, Tasks, Activity, Profile)
│   │   ├── index.tsx                # Home Dashboard (Sections A to F)
│   │   ├── tasks.tsx                # Task Management (Filter tabs, search, sort)
│   │   ├── activity.tsx             # Activity feed & monthly reports
│   │   └── profile.tsx              # Profile, settings, and admin menu
│   ├── add-income.tsx               # Add income entry modal
│   ├── add-expense.tsx              # Submit company expense modal
│   ├── expense-group-detail.tsx     # Itemized flexible expense review
│   ├── task-detail.tsx              # Task details & cancellation
│   ├── configure-budget.tsx         # Monthly budget configuration modal
│   ├── create-task.tsx              # Create fixed financial task modal
│   ├── recurring-tasks.tsx          # Recurring expense templates
│   ├── manage-employees.tsx         # Admin employee directory
│   └── notifications.tsx            # In-app notifications center
├── src/
│   ├── components/                  # Google Material 3 Design System
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── Header.tsx
│   │   ├── TaskCard.tsx
│   │   ├── EmptyState.tsx
│   │   ├── FAB.tsx
│   │   ├── AddActionModal.tsx
│   │   ├── TaskCompletionModal.tsx
│   │   └── MonthSelectorModal.tsx
│   ├── constants/
│   │   └── theme.ts                 # Tokens: #1A73E8, spacing, typography
│   ├── context/
│   │   └── AuthContext.tsx          # Reactive Auth & Selected Month State
│   ├── services/
│   │   ├── firebase.ts              # Firebase Client SDK & persistence
│   │   ├── apiClient.ts             # Backend HTTP client with ID token
│   │   ├── authService.ts           # Authentication & employee management
│   │   ├── budgetService.ts         # Budget periods & calculations
│   │   ├── taskService.ts           # Tasks & recurring templates
│   │   ├── incomeService.ts         # Income submissions & voiding
│   │   ├── expenseService.ts        # Flexible expenses & review
│   │   ├── activityService.ts       # Audit logging & monthly reports
│   │   └── notificationService.ts   # Android channels & token handling
│   ├── types/
│   │   └── index.ts                 # TypeScript interfaces & Zod schemas
│   └── utils/
│       └── formatters.ts            # Currency (₹), date, and month formatting
├── tests/
│   └── financialLogic.test.ts       # Test suite verifying financial formulas
├── firestore.rules                  # Production Firestore Security Rules
├── firestore.indexes.json           # Composite compound query indexes
├── vercel.json                      # Vercel functions & cron configuration
├── eas.json                         # EAS Build configuration for Android
└── package.json
```
