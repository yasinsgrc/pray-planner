package com.vakit;

import android.content.res.Configuration;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.vakit.widget.WidgetBridgePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local eklentiler (npm paketi değil) — Bridge başlatılmadan önce
        // kaydedilmeli (design-refresh-v3 Faz 23 Commit 4).
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(StatusBarAppearancePlugin.class);
        super.onCreate(savedInstanceState);
        applyStatusBarAppearance();
    }

    // edge-to-edge (targetSdk 36) altında window.statusBarColor no-op olduğundan
    // ikon rengi yalnızca isAppearanceLightStatusBars ile kontrol edilebiliyor.
    // Bu yalnızca WebView hidrate olmadan önceki ilk kare için varsayılan;
    // hidrasyon sonrası tema kararı StatusBarAppearancePlugin üzerinden
    // web katmanından geliyor.
    private void applyStatusBarAppearance() {
        boolean isNight = (getResources().getConfiguration().uiMode
                & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(!isNight);
        controller.setAppearanceLightNavigationBars(!isNight);
    }
}
