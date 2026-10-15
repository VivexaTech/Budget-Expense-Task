const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin for 5 Native Android Home-Screen Widgets
 * 1. Add Income Widget (companybudget://add-income)
 * 2. Add Client Widget (companybudget://create-client)
 * 3. Add Expense Widget (companybudget://add-expense)
 * 4. Complete Task Widget (companybudget://(tabs)/tasks)
 * 5. Target Remaining Widget (companybudget://(tabs))
 */

const WIDGETS = [
  {
    name: '.widgets.AddIncomeWidgetProvider',
    resource: '@xml/widget_add_income_info',
  },
  {
    name: '.widgets.AddClientWidgetProvider',
    resource: '@xml/widget_add_client_info',
  },
  {
    name: '.widgets.AddExpenseWidgetProvider',
    resource: '@xml/widget_add_expense_info',
  },
  {
    name: '.widgets.CompleteTaskWidgetProvider',
    resource: '@xml/widget_complete_task_info',
  },
  {
    name: '.widgets.TargetRemainingWidgetProvider',
    resource: '@xml/widget_target_remaining_info',
  },
];

function modifyAndroidManifest(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }

    WIDGETS.forEach((widget) => {
      // Check if receiver already exists
      const existing = mainApplication.receiver.find(
        (r) => r.$['android:name'] === widget.name
      );

      if (!existing) {
        mainApplication.receiver.push({
          $: {
            'android:name': widget.name,
            'android:exported': 'true',
            'android:label': '@string/app_name',
          },
          'intent-filter': [
            {
              action: [
                {
                  $: {
                    'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
                  },
                },
              ],
            },
          ],
          'meta-data': [
            {
              $: {
                'android:name': 'android.appwidget.provider',
                'android:resource': widget.resource,
              },
            },
          ],
        });
      }
    });

    return config;
  });
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else if (exists) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

function copyWidgetFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidMain = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main'
      );

      const srcRes = path.join(projectRoot, 'widgets', 'android', 'res');
      const destRes = path.join(androidMain, 'res');

      const srcJava = path.join(projectRoot, 'widgets', 'android', 'java');
      const destJava = path.join(androidMain, 'java');

      if (fs.existsSync(srcRes)) {
        copyRecursiveSync(srcRes, destRes);
      }

      if (fs.existsSync(srcJava)) {
        copyRecursiveSync(srcJava, destJava);
      }

      return config;
    },
  ]);
}

module.exports = function withAndroidWidgets(config) {
  config = modifyAndroidManifest(config);
  config = copyWidgetFiles(config);
  return config;
};
