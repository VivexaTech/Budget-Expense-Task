package com.vivexatech.budgettaskmanager.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import com.vivexatech.budgettaskmanager.R;
import java.text.NumberFormat;
import java.util.Locale;

public class TargetRemainingWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "CompanyBudgetWidgetPrefs";
    private static final String KEY_TARGET = "monthly_target";
    private static final String KEY_REMAINING = "target_remaining";
    private static final String KEY_COMPANY = "company_name";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_target_remaining);

        // Read cached metrics from SharedPreferences (written by mobile app)
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        double target = (double) prefs.getFloat(KEY_TARGET, 0f);
        double remaining = (double) prefs.getFloat(KEY_REMAINING, 0f);
        String companyName = prefs.getString(KEY_COMPANY, "Company Budget");

        NumberFormat formatter = NumberFormat.getCurrencyInstance(new Locale("en", "IN"));
        formatter.setMaximumFractionDigits(0);

        views.setTextViewText(R.id.widget_company_name, companyName);
        if (target > 0) {
            views.setTextViewText(R.id.widget_target_val, formatter.format(target));
            views.setTextViewText(R.id.widget_remaining_val, formatter.format(remaining));
            views.setTextViewText(R.id.widget_balance_val, "Tap to open full workspace");
        } else {
            views.setTextViewText(R.id.widget_target_val, "₹--");
            views.setTextViewText(R.id.widget_remaining_val, "₹--");
            views.setTextViewText(R.id.widget_balance_val, "Open app to sync financials");
        }

        // Deep link to Main Dashboard
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("companybudget://(tabs)"));
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                1005,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        views.setOnClickPendingIntent(R.id.widget_target_root, pendingIntent);
        views.setOnClickPendingIntent(R.id.btn_action_dashboard, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
